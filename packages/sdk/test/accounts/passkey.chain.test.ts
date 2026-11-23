import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { WebAuthnValidator } from "@namera-ai/contracts"
import { AccountError, KernelAccount, NexusAccount, Safe7579Account, SmartAccount } from "@namera-ai/sdk"
import * as WebAuthn from "@namera-ai/sdk/internal/core/account/webauthn"
import { keccak256, toHex, zeroAddress } from "viem"
import type { WebAuthnAccount } from "viem/account-abstraction"

import { client, devnet, newOwner } from "./accounts.test-utils.ts"
import { newPasskey } from "./passkey.test-utils.ts"

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

const reasonOf = (error: unknown) => {
  assert.isTrue(AccountError.isAccountError(error))
  return (error as AccountError.AccountError).reason._tag
}

type Owner = WebAuthnAccount | SmartAccount.Passkeys

// Nexus and Safe7579 deploy through unstaked factories, so the devnet deploys them first (see Devnet.deploy).
const builders = {
  kernel: { build: (owner: Owner) => KernelAccount.from({ client, owner }), predeploy: false },
  nexus: { build: (owner: Owner) => NexusAccount.from({ client, owner }), predeploy: true },
  safe7579: {
    build: (owner: Owner) =>
      "passkeys" in owner
        ? Safe7579Account.from({ client, owners: owner.passkeys, threshold: owner.threshold })
        : Safe7579Account.from({ client, owners: [owner] }),
    predeploy: true
  }
} as const

const ready = async (type: keyof typeof builders, owner: Owner) => {
  const account = await builders[type].build(owner)
  await devnet.fund(account.address)
  if (builders[type].predeploy) await devnet.deploy(account)
  return account
}

const verifies = async (account: SmartAccount.SmartAccount) => {
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

describe("WebAuthnValidator's encodings", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  it("match the contract's credential ids, ERC-1271 digests and multichain challenges", async () => {
    const passkey = newPasskey()
    const { x, y } = {
      x: toHex(BigInt(`0x${passkey.publicKey.slice(4, 68)}`), { size: 32 }),
      y: toHex(BigInt(`0x${passkey.publicKey.slice(68)}`), { size: 32 })
    }
    const read = <Name extends "credentialId" | "replaySafeHash" | "multichainChallenge">(
      functionName: Name,
      args: ReadonlyArray<unknown>
    ) => client.readContract({ ...WebAuthnValidator.v1, functionName, args } as never) as Promise<`0x${string}`>
    const hash = keccak256(toHex("permit"))
    const account = newOwner().address

    assert.strictEqual(await read("credentialId", [x, y]), WebAuthn.credentialId(passkey.publicKey))
    assert.strictEqual(
      await read("replaySafeHash", [account, hash]),
      WebAuthn.replaySafeHash({ validator: WebAuthnValidator.v1.address, chainId: devnet.chain.id, account, hash })
    )
    assert.strictEqual(await read("multichainChallenge", [hash]), WebAuthn.multichainChallenge(hash))
  })
})

describe.each(["kernel", "nexus", "safe7579"] as const)("a passkey %s account", { concurrent: false }, (type) => {
  devnet.isolate({ beforeEach, afterEach })

  it("runs user operations verified with the P-256 precompile, with Smart Sessions installed", async () => {
    const account = await ready(type, newPasskey())

    // The stub's backend byte asks for the precompile, which the devnet (Osaka) has.
    assert.strictEqual((await account.getStubSignature()).slice(4, 6), "00")
    assert.isTrue((await devnet.sendUserOperation(account, [{ to: zeroAddress, value: 1n }])).success)
    assert.isTrue((await devnet.sendUserOperation(account, [{ to: zeroAddress, value: 2n }])).success)
    assert.isTrue(await SmartAccount.isSessionsInstalled(client, { address: account.address }))
  })

  it("signs ERC-1271 messages and typed data that viem verifies, before and after deployment", async () => {
    const account = await builders[type].build(newPasskey())
    await devnet.fund(account.address)

    await verifies(account)
    if (builders[type].predeploy) await devnet.deploy(account)
    await devnet.sendUserOperation(account, [{ to: zeroAddress }])
    await verifies(account)
  })

  it("needs the threshold of its passkeys, one prompt each", async () => {
    let prompts = 0
    const onPrompt = () => {
      prompts += 1
    }
    const passkeys = [newPasskey({ onPrompt }), newPasskey({ onPrompt }), newPasskey({ onPrompt })]
    const account = await ready(type, { passkeys, threshold: 2 })
    prompts = 0

    assert.isTrue((await devnet.sendUserOperation(account, [{ to: zeroAddress, value: 1n }])).success)
    assert.strictEqual(prompts, 2)

    // Signing with one passkey fewer than the threshold fails on chain.
    const short = await SmartAccount.fromAddress({
      client,
      address: account.address,
      owner: { passkeys: passkeys.slice(0, 1) }
    })
    const error = await rejection(devnet.sendUserOperation(short, [{ to: zeroAddress, value: 2n }]))
    assert.include(String(error), "AA24")
  })

  it("connects to the existing account with fromAddress", async () => {
    const passkey = newPasskey()
    const account = await ready(type, passkey)
    await devnet.sendUserOperation(account, [{ to: zeroAddress }])

    const connected = await SmartAccount.fromAddress({ client, address: account.address, owner: passkey })
    assert.strictEqual(connected.namera.type, type)
    assert.strictEqual(connected.address, account.address)
    assert.isTrue((await devnet.sendUserOperation(connected, [{ to: zeroAddress, value: 1n }])).success)
  })
})

describe("passkey owners", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  it("bind ERC-1271 signatures to the account: another account of the same passkey rejects them", async () => {
    const passkey = newPasskey()
    const first = await ready("nexus", passkey)
    const second = await NexusAccount.from({ client, owner: passkey, index: 1n })
    await devnet.fund(second.address)
    await devnet.deploy(second)

    const signature = await first.signMessage({ message: "hello" })
    assert.isTrue(await client.verifyMessage({ address: first.address, message: "hello", signature }))
    assert.isFalse(await client.verifyMessage({ address: second.address, message: "hello", signature }))
  })

  it("sign user operations of three accounts with one prompt", async () => {
    let prompts = 0
    const passkey = newPasskey({
      onPrompt: () => {
        prompts += 1
      }
    })
    const accounts = await Promise.all((["kernel", "nexus", "safe7579"] as const).map((type) => ready(type, passkey)))

    const prepared = await Promise.all(accounts.map(async (account) => {
      const bundler = devnet.bundlerClient(account, { bundleOnReceipt: true })
      const signature = await SmartAccount.getMultichainStubSignature(account, { count: accounts.length })
      const userOperation = await bundler.prepareUserOperation({
        calls: [{ to: zeroAddress, value: 1n }],
        signature
      })
      return { account, bundler, userOperation }
    }))
    prompts = 0
    const signatures = await SmartAccount.signUserOperations({ userOperations: prepared })
    assert.strictEqual(prompts, 1)

    for (const [index, { bundler, userOperation }] of prepared.entries()) {
      const hash = await bundler.sendUserOperation({ ...userOperation, signature: signatures[index]! } as never)
      assert.isTrue((await bundler.waitForUserOperationReceipt({ hash })).success)
    }
  })

  it("refuse multichain signing for accounts without passkeys or with other passkeys", async () => {
    const ecdsa = await KernelAccount.from({ client, owner: newOwner() })
    const [a, b] = await Promise.all([
      KernelAccount.from({ client, owner: newPasskey() }),
      KernelAccount.from({ client, owner: newPasskey() })
    ])
    await devnet.fund(a.address)
    const userOperation = await devnet.bundlerClient(a).prepareUserOperation({ calls: [{ to: zeroAddress }] })

    assert.strictEqual(
      reasonOf(await rejection(SmartAccount.getMultichainStubSignature(ecdsa, { count: 2 }))),
      "InvalidOptions"
    )
    assert.strictEqual(
      reasonOf(
        await rejection(SmartAccount.signUserOperations({
          userOperations: [{ account: a, userOperation }, { account: b, userOperation }]
        }))
      ),
      "InvalidOptions"
    )
    assert.deepStrictEqual(await SmartAccount.signUserOperations({ userOperations: [] }), [])
  })

  it("are refused where they can't work, and when the passkey set is invalid", async () => {
    const passkey = newPasskey()
    const owner = newOwner()
    const delegated = await KernelAccount.fromEip7702({ client, owner })
    await devnet.fund(delegated.address)
    await devnet.sendUserOperation(delegated, [{ to: zeroAddress }])

    const invalid = [
      rejection(KernelAccount.fromEip7702({ client, owner: passkey as never })),
      rejection(SmartAccount.fromAddress({ client, address: delegated.address, owner: passkey })),
      rejection(KernelAccount.from({ client, owner: { passkeys: [] } })),
      rejection(NexusAccount.from({ client, owner: { passkeys: [passkey, passkey] } })),
      rejection(NexusAccount.from({ client, owner: { passkeys: [passkey], threshold: 2 } })),
      rejection(KernelAccount.from({ client, owner: { passkeys: Array.from({ length: 17 }, () => newPasskey()) } })),
      rejection(Safe7579Account.from({ client, owners: [passkey, owner] as never })),
      rejection(Safe7579Account.from({ client, owners: [passkey], threshold: 0 }))
    ]
    for (const error of await Promise.all(invalid)) {
      assert.strictEqual(reasonOf(error), "InvalidOptions")
    }
  })
})
