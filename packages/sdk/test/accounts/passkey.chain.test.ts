import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { External } from "@namera-ai/contracts"
import { AccountError, KernelAccount, NexusAccount, SmartAccount } from "@namera-ai/sdk"
import { toKernelSmartAccount } from "permissionless/accounts"
import { decodeAbiParameters, decodeFunctionData, parseAbi, zeroAddress } from "viem"
import { entryPoint07Address } from "viem/account-abstraction"

import { client, devnet, newOwner, sameBytes } from "./accounts.test-utils.ts"
import { newPasskey } from "./passkey.test-utils.ts"

const kernel = External.kernel["3.3"]
const typedData = {
  domain: { name: "Example", version: "1", chainId: devnet.chain.id, verifyingContract: zeroAddress },
  types: { Mail: [{ name: "contents", type: "string" }] },
  primaryType: "Mail",
  message: { contents: "hello" }
} as const

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected a rejection"),
    (error: unknown) => error
  )

const verify = async (account: KernelAccount.KernelAccount) => {
  assert.isTrue(
    await client.verifyMessage({
      address: account.address,
      message: "hello",
      signature: await account.signMessage({ message: "hello" })
    })
  )
  assert.isTrue(
    await client.verifyTypedData({
      address: account.address,
      ...typedData,
      signature: await account.signTypedData(typedData)
    })
  )
}

describe("a passkey owner", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  it("gives the same Kernel address and deployment as permissionless, through the WebAuthn validator", async () => {
    const passkey = newPasskey()
    const ours = await KernelAccount.from({ client, owner: passkey, sessions: false })
    const reference = await toKernelSmartAccount({
      client,
      owners: [passkey],
      version: "0.3.3",
      // permissionless has no default WebAuthn validator for Kernel 3.3; this is the one it uses for 3.1 and 3.2.
      validatorAddress: kernel.webAuthnValidator,
      entryPoint: { address: entryPoint07Address, version: "0.7" }
    })

    assert.strictEqual(ours.address, reference.address)
    const [factory, referenceFactory] = [await ours.getFactoryArgs(), await reference.getFactoryArgs()]
    assert.strictEqual(factory.factory, referenceFactory.factory)
    assert.isTrue(sameBytes(factory.factoryData, referenceFactory.factoryData))
    // The root validator is ZeroDev's WebAuthn validator.
    const [, initData] = decodeFunctionData({
      abi: parseAbi(["function deployWithFactory(address factory, bytes createData, bytes32 salt)"]),
      data: factory.factoryData!
    }).args
    assert.include(initData.toLowerCase(), kernel.webAuthnValidator.slice(2).toLowerCase())
  })

  it("deploys a Kernel account and runs user operations, verified with the P-256 precompile", async () => {
    const account = await KernelAccount.from({ client, owner: newPasskey() })
    await devnet.fund(account.address)

    // The stub signature asks for the precompile, which the devnet (Osaka) has.
    const [, , , , , usePrecompiled] = decodeAbiParameters(
      parseAbi(["function f(bytes, string, uint256, uint256, uint256, bool)"])[0].inputs,
      await account.getStubSignature()
    )
    assert.isTrue(usePrecompiled)

    assert.isTrue((await devnet.sendUserOperation(account, [{ to: zeroAddress, value: 1n }])).success)
    assert.isTrue(await SmartAccount.isSessionsInstalled(client, { address: account.address }))
    assert.isTrue((await devnet.sendUserOperation(account, [{ to: zeroAddress, value: 2n }])).success)
  })

  it("signs ERC-1271 messages and typed data that viem verifies, before and after deployment", async () => {
    const account = await KernelAccount.from({ client, owner: newPasskey() })
    await devnet.fund(account.address)

    await verify(account)
    await devnet.sendUserOperation(account, [{ to: zeroAddress }])
    await verify(account)
  })

  it("connects to an existing passkey Kernel with fromAddress", async () => {
    const passkey = newPasskey()
    const account = await KernelAccount.from({ client, owner: passkey })
    await devnet.fund(account.address)
    await devnet.sendUserOperation(account, [{ to: zeroAddress }])

    const connected = await SmartAccount.fromAddress({ client, address: account.address, owner: passkey })
    assert.strictEqual(connected.namera.type, "kernel")
    assert.isTrue((await devnet.sendUserOperation(connected, [{ to: zeroAddress, value: 1n }])).success)
  })

  it("is refused where it can't work: EIP-7702, and accounts other than Kernel", async () => {
    const owner = newOwner()
    const nexus = await NexusAccount.from({ client, owner })
    await devnet.fund(nexus.address)
    await devnet.deploy(nexus)

    const error = await rejection(SmartAccount.fromAddress({ client, address: nexus.address, owner: newPasskey() }))
    assert.isTrue(AccountError.isAccountError(error))
    assert.strictEqual((error as AccountError.AccountError).reason._tag, "InvalidOptions")
    const eip7702 = await rejection(
      KernelAccount.fromEip7702({ client, owner: newPasskey() as never })
    )
    assert.strictEqual((eip7702 as AccountError.AccountError).reason._tag, "InvalidOptions")
  })
})
