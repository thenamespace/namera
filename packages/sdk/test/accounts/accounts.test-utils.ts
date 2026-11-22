import { inject } from "@effect/vitest"
import { TestChain } from "@namera-ai/sdk/testing"
import {
  type Chain,
  createPublicClient,
  type Hex,
  http,
  type HttpTransport,
  parseEther,
  type PublicClient,
  type Transport
} from "viem"
import { type BundlerClient, createBundlerClient, type SmartAccount } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { signAuthorization } from "viem/actions"

export const chain = await TestChain.from(inject(TestChain.contextKey))

export const client: PublicClient<Transport, Chain> = createPublicClient({
  chain: chain.chain,
  transport: http(chain.rpcUrl)
})

/** A fresh owner key, so every test's accounts are new. */
export const newOwner = () => privateKeyToAccount(generatePrivateKey())

export const fund = (address: Hex, ether = "1") =>
  client.request({
    method: "anvil_setBalance" as "eth_chainId",
    params: [address, `0x${parseEther(ether).toString(16)}`] as never
  })

type TestBundler = BundlerClient<HttpTransport, Chain, SmartAccount, typeof client>

// alto has the receipt as soon as `sendBundleNow` returns, so the first poll after it finds the operation.
export const bundlerFor = (account: SmartAccount): TestBundler =>
  createBundlerClient({ account, client, transport: http(chain.bundlerUrl), pollingInterval: 50 })

/**
 * A bundler client that bundles alto's mempool when it first asks for a receipt: the operation is in the mempool by
 * then, so functions that send and then wait (`installSessionsSync`) complete without the test polling.
 */
export const autoBundlingBundlerFor = (account: SmartAccount): TestBundler => {
  let bundled = false
  return createBundlerClient({
    account,
    client,
    pollingInterval: 50,
    transport: http(chain.bundlerUrl, {
      onFetchRequest: async (request) => {
        if (bundled || !(await request.clone().text()).includes("eth_getUserOperationReceipt")) return
        bundled = true
        await chain.sendBundleNow()
      }
    })
  })
}

/** Compares two hex strings as bytes: ox writes lowercase hex, viem keeps checksummed addresses. */
export const sameBytes = (a: Hex | undefined, b: Hex | undefined) => a?.toLowerCase() === b?.toLowerCase()

/** Sends one user operation through alto, bundles it at once and returns its receipt. */
export const send = async (
  account: SmartAccount,
  calls: ReadonlyArray<{ readonly to: Hex; readonly value?: bigint | undefined; readonly data?: Hex | undefined }>
) => {
  const bundler = bundlerFor(account)
  // An EIP-7702 account's first operation carries the owner's signed authorization; viem only stubs it for gas.
  const authorization = account.authorization !== undefined && !(await account.isDeployed())
    ? await signAuthorization(client, account.authorization)
    : undefined
  const hash = await bundler.sendUserOperation({
    calls: [...calls],
    ...(authorization === undefined ? {} : { authorization })
  })
  await chain.sendBundleNow()
  return bundler.waitForUserOperationReceipt({ hash })
}

/** Isolates each test of a file on the shared chain. */
export const isolate = (
  hooks: { beforeEach: (f: () => Promise<void>) => void; afterEach: (f: () => Promise<void>) => void }
) => {
  let snapshot: Hex
  hooks.beforeEach(async () => {
    snapshot = await chain.snapshot()
  })
  hooks.afterEach(() => chain.revert(snapshot))
}
