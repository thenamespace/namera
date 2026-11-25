import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { Bundler, Grant, NameraError, Policy, PolicyViolationError, Session, SessionKey } from "@namera-ai/sdk"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  hashTypedData,
  type Hex,
  http,
  parseAbi,
  parseEther
} from "viem"
import { entryPoint07Abi, entryPoint07Address } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

import { client, devnet } from "./accounts/accounts.test-utils.ts"
import { deployedAccount } from "./session.test-utils.ts"

// The agent's EIP-1193 provider on the devnet (safe-mode alto): viem's wallet client through `custom`, a policy refusal that reaches the app as the Namera error, and a batch sponsored by an
// ERC-7677 paymaster service.

const token = privateKeyToAccount(generatePrivateKey()).address
const recipient = privateKeyToAccount(generatePrivateKey()).address
const erc20 = parseAbi(["function transfer(address to, uint256 amount)"])
const erc1271 = parseAbi(["function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)"])
const transfer = (amount: bigint) => ({
  to: token,
  data: encodeFunctionData({ abi: erc20, functionName: "transfer", args: [recipient, amount] })
})

const permit = (value: bigint) => ({
  domain: { name: "Token", version: "1", chainId: devnet.chain.id, verifyingContract: token },
  types: { Permit: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }] },
  primaryType: "Permit" as const,
  message: { spender: recipient, value }
})

const policies = [
  Policy.erc20Transfer({ token, to: [recipient], amount: { lte: 100n } }),
  Policy.signTypedData({ ...permit(0n), message: { spender: recipient, value: { lte: 10n } } }),
  Policy.gas({ maxCost: 10n ** 18n, period: "lifetime" })
]

const grantFor = async (options: { readonly sponsored?: boolean } = {}) => {
  const sessionKey = privateKeyToAccount(generatePrivateKey())
  const session = Session.from({
    signer: SessionKey.ecdsa(sessionKey.address),
    validUntil: Session.now() + 30 * 86400,
    sponsored: options.sponsored,
    policies
  })
  const account = await deployedAccount()
  const grant = await Grant.create({ account, session })
  return { grant, sessionKey, address: account.address }
}

const bundler = () => Bundler.from({ url: devnet.bundlerUrl })

/** What the verifying contract (the token) hears from the account when it checks a signature of `typedData`. */
const verifiedByToken = (address: Hex, typedData: ReturnType<typeof permit>, signature: Hex) =>
  client.readContract({
    account: token,
    address,
    abi: erc1271,
    functionName: "isValidSignature",
    args: [hashTypedData(typedData), signature]
  })

/** The EIP-1193 error a viem error wraps: the provider's own, with its code and data. */
const providerError = (error: unknown) => {
  let current = error as { readonly cause?: unknown; readonly code?: unknown; readonly data?: unknown } | undefined
  while (current !== undefined && (current as { readonly name?: unknown }).name !== "ProviderRpcError") {
    current = current.cause as typeof current
  }
  assert.isDefined(current, String(error))
  return current as { readonly code: number; readonly data?: unknown }
}

const rejection = (promise: Promise<unknown>) =>
  promise.then(() => assert.fail("expected a rejection"), (error: unknown) => providerError(error))

describe("Grant.toProvider on a Kernel account", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  it("works as viem's custom transport, forwarding reads and refusing transactions", async () => {
    const { address, grant, sessionKey } = await grantFor()
    const provider = await Grant.toProvider({ grant, signer: sessionKey, client, bundler: bundler() })
    const wallet = createWalletClient({ account: address, chain: devnet.chain, transport: custom(provider) })

    const { id } = await wallet.sendCalls({ calls: [transfer(1n)], forceAtomic: true })
    await devnet.sendBundleNow()
    assert.strictEqual((await wallet.waitForCallsStatus({ id, pollingInterval: 50 })).status, "success")
    // The batch's id is its user operation's hash, which the bundler knows.
    const receipt = await devnet.bundlerClient(await Grant.toAccount(client, { grant, signer: sessionKey }))
      .getUserOperationReceipt({ hash: id as Hex })
    assert.isTrue(receipt.success)

    // eth_signTypedData_v4: viem sends the typed data as JSON, its integers as strings.
    const signature = await wallet.signTypedData(permit(5n))
    assert.strictEqual(await verifiedByToken(address, permit(5n), signature), "0x1626ba7e")
    assert.strictEqual(
      providerError(await wallet.signTypedData(permit(11n)).catch((error: unknown) => error)).code,
      4100
    )

    const reads = createPublicClient({ chain: devnet.chain, transport: custom(provider) })
    assert.strictEqual(await reads.getBalance({ address }), await client.getBalance({ address }))
    assert.strictEqual(await reads.getBlockNumber(), await client.getBlockNumber())

    // What AgentKit's viem wallet provider sends: a session key signs no transactions.
    assert.strictEqual((await rejection(wallet.sendTransaction({ to: recipient, value: 0n }))).code, 4200)
  })

  it("refuses a batch its policies don't allow before signing, with the Namera error as data", async () => {
    const { address, grant, sessionKey } = await grantFor()
    const provider = await Grant.toProvider({ grant, signer: sessionKey, client, bundler: bundler() })
    const wallet = createWalletClient({ account: address, chain: devnet.chain, transport: custom(provider) })

    const error = await rejection(wallet.sendCalls({ calls: [transfer(1_000n)] }))
    assert.strictEqual(error.code, 4100)
    const received = NameraError.fromJSON(error.data)
    assert.instanceOf(received, PolicyViolationError.PolicyViolationError)
    assert.strictEqual((received as PolicyViolationError.PolicyViolationError).reason._tag, "ArgumentRejected")
  })

  describe("with an ERC-7677 paymaster service", () => {
    // A paymaster that sponsors every operation: `validatePaymasterUserOp` returns an empty context and validation
    // data 0, so the EntryPoint never calls `postOp` (`mstore(0, 0x40) return(0, 0x60)`). It touches no storage, so
    // safe-mode alto accepts it unstaked.
    const paymaster = "0x00000000000000000000000000000000000a7677" as const
    const requests: Array<string> = []
    let server: Server
    let url: string

    beforeEach(async () => {
      await devnet.client.request({ method: "anvil_setCode" as never, params: [paymaster, "0x604060005260606000f3"] })
      const funder = createWalletClient({
        account: privateKeyToAccount(devnet.keys[0]!),
        chain: devnet.chain,
        transport: http(devnet.rpcUrl)
      })
      const hash = await funder.writeContract({
        address: entryPoint07Address,
        abi: entryPoint07Abi,
        functionName: "depositTo",
        args: [paymaster],
        value: parseEther("1")
      })
      await client.waitForTransactionReceipt({ hash, pollingInterval: 50 })

      // The paymaster's ERC-7677 service: the same fields for the stub and the final data.
      requests.length = 0
      server = createServer((request, response) => {
        let body = ""
        request.on("data", (chunk) => (body += chunk))
        request.on("end", () => {
          const { id, method } = JSON.parse(body) as { readonly id: number; readonly method: string }
          requests.push(method)
          response.setHeader("content-type", "application/json")
          response.end(JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              paymaster,
              paymasterData: "0x",
              paymasterVerificationGasLimit: "0x8000",
              paymasterPostOpGasLimit: "0x0"
            }
          }))
        })
      })
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
      url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    })
    afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())))

    it("sponsors a batch that names it in its capabilities", async () => {
      const { address, grant, sessionKey } = await grantFor({ sponsored: true })
      const provider = await Grant.toProvider({ grant, signer: sessionKey, client, bundler: bundler() })
      const wallet = createWalletClient({ account: address, chain: devnet.chain, transport: custom(provider) })
      const balance = await client.getBalance({ address })

      const { id } = await wallet.sendCalls({
        calls: [transfer(1n)],
        capabilities: { paymasterService: { url } }
      })
      await devnet.sendBundleNow()
      assert.strictEqual((await wallet.waitForCallsStatus({ id, pollingInterval: 50 })).status, "success")

      assert.includeMembers(requests, ["pm_getPaymasterStubData", "pm_getPaymasterData"])
      // The paymaster paid: the account's balance is untouched.
      assert.strictEqual(await client.getBalance({ address }), balance)
    })
  })
})
