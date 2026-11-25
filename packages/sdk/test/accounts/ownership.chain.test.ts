import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { AccountError, KernelAccount, SmartAccount } from "@namera-ai/sdk"
import { zeroAddress } from "viem"
import type { WebAuthnAccount } from "viem/account-abstraction"

import { client, devnet, newOwner } from "./accounts.test-utils.ts"
import { newPasskey } from "./passkey.test-utils.ts"

type Owner = ReturnType<typeof newOwner>

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected a rejection"),
    (error: unknown) => error
  )

const reasonOf = (error: unknown) => {
  assert.isTrue(AccountError.isAccountError(error), String(error))
  return (error as AccountError.AccountError).reason._tag
}

const build = async (owner: Owner | WebAuthnAccount | SmartAccount.Passkeys) => {
  const account = await KernelAccount.from({ client, owner })
  await devnet.fund(account.address)
  await devnet.sendUserOperation(account, [{ to: zeroAddress }])
  return account
}

const bundler = (account: SmartAccount.SmartAccount) => devnet.bundlerClient(account, { bundleOnReceipt: true })

// The account as `owner` signs for it.
const as = (account: SmartAccount.SmartAccount, owner: Owner | WebAuthnAccount | SmartAccount.Passkeys) =>
  SmartAccount.fromAddress({ client, address: account.address, owner })

const sends = async (account: SmartAccount.SmartAccount) =>
  (await devnet.sendUserOperation(account, [{ to: zeroAddress, value: 1n }])).success

const fails = async (account: SmartAccount.SmartAccount) => {
  const error = await rejection(devnet.sendUserOperation(account, [{ to: zeroAddress, value: 1n }]))
  assert.include(String(error), "AA24")
}

describe("owners of a Kernel account", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  it("reads its key owner or its passkeys, and nothing before deployment", async () => {
    const key = newOwner()
    const passkey = newPasskey()
    const [keyed, passkeyed] = [await build(key), await build(passkey)]

    assert.deepStrictEqual(await SmartAccount.getOwners(client, { address: keyed.address }), [
      {
        type: "key",
        validator: (await SmartAccount.getOwners(client, { address: keyed.address }))[0]!.validator,
        owners: [key.address],
        threshold: 1
      }
    ])
    const [set] = await SmartAccount.getOwners(client, { address: passkeyed.address })
    assert.strictEqual(set?.type, "passkey")
    assert.strictEqual(set?.type === "passkey" ? set.passkeys[0]?.publicKey : undefined, passkey.publicKey)
    assert.strictEqual(set?.threshold, 1)

    const undeployed = await KernelAccount.from({ client, owner: newOwner() })
    assert.deepStrictEqual(await SmartAccount.getOwners(client, { address: undeployed.address }), [])
    assert.strictEqual(
      reasonOf(await rejection(SmartAccount.addOwnerCalls(undeployed, { owner: newPasskey() }))),
      "OperationNotSupported"
    )
  })

  it("adds a passkey that then signs, and raises the threshold to need both", async () => {
    const [first, second] = [newPasskey(), newPasskey()]
    const account = await build(first)

    await SmartAccount.addOwnerSync(bundler(account), { owner: second })
    assert.isTrue(await sends(await as(account, second)))

    await SmartAccount.setThresholdSync(bundler(account), { threshold: 2 })
    const [set] = await SmartAccount.getOwners(client, { address: account.address })
    assert.strictEqual(set?.threshold, 2)
    assert.isTrue(await sends(await as(account, { passkeys: [first, second], threshold: 2 })))
    // Refused before sending: the threshold would be unreachable.
    assert.strictEqual(
      reasonOf(await rejection(SmartAccount.removeOwnerCalls(account, { owner: first }))),
      "ThresholdUnreachable"
    )
  })

  it("removes a passkey, which then can't sign", async () => {
    const [first, second] = [newPasskey(), newPasskey()]
    const account = await build({ passkeys: [first, second], threshold: 1 })

    await SmartAccount.removeOwnerSync(bundler(await as(account, second)), { owner: first })
    const [set] = await SmartAccount.getOwners(client, { address: account.address })
    assert.deepStrictEqual(set?.type === "passkey" ? set.passkeys.map(({ publicKey }) => publicKey) : [], [
      second.publicKey
    ])
    await fails(await as(account, first))
    assert.isTrue(await sends(await as(account, second)))
  })

  it("replaces a passkey, and its key, in one operation each", async () => {
    const [passkey, replacement] = [newPasskey(), newPasskey()]
    const passkeyed = await build(passkey)
    await SmartAccount.replaceOwnerSync(bundler(passkeyed), { owner: passkey, with: replacement })
    await fails(await as(passkeyed, passkey))
    assert.isTrue(await sends(await as(passkeyed, replacement)))

    const [key, next] = [newOwner(), newOwner()]
    const keyed = await build(key)
    await SmartAccount.replaceOwnerSync(bundler(keyed), { owner: key, with: next })
    await fails(await as(keyed, key))
    assert.isTrue(await sends(await as(keyed, next)))
    const [set] = await SmartAccount.getOwners(client, { address: keyed.address })
    assert.deepStrictEqual(set?.type === "key" ? set.owners : [], [next.address])
  })

  it("adds passkeys to an account owned by a key, and a key to one owned by passkeys", async () => {
    const key = newOwner()
    const passkey = newPasskey()
    const keyed = await build(key)
    await SmartAccount.addOwnerValidatorSync(bundler(keyed), { owner: passkey })
    assert.isTrue(await sends(await as(keyed, passkey)))
    assert.isTrue(await sends(await as(keyed, key)))
    assert.deepStrictEqual(
      (await SmartAccount.getOwners(client, { address: keyed.address })).map(({ type }) => type),
      ["key", "passkey"]
    )

    const other = newOwner()
    const passkeyed = await build(newPasskey())
    await SmartAccount.addOwnerValidatorSync(bundler(passkeyed), { owner: other })
    assert.isTrue(await sends(await as(passkeyed, other)))
    // With both kinds, a threshold must say which owners it is for.
    assert.strictEqual(
      reasonOf(await rejection(SmartAccount.setThresholdCalls(passkeyed, { threshold: 1 }))),
      "InvalidOptions"
    )
  })

  it("refuses changes it can't make before sending them", async () => {
    const key = newOwner()
    const account = await build(key)

    assert.strictEqual(
      reasonOf(await rejection(SmartAccount.removeOwnerCalls(account, { owner: newOwner() }))),
      "OwnerNotFound"
    )
    assert.strictEqual(
      reasonOf(await rejection(SmartAccount.addOwnerCalls(account, { owner: newPasskey() }))),
      "OperationNotSupported"
    )
    assert.strictEqual(
      reasonOf(await rejection(SmartAccount.addOwnerValidatorCalls(account, { owner: newOwner() }))),
      "OperationNotSupported"
    )
    assert.strictEqual(
      reasonOf(await rejection(SmartAccount.replaceOwnerCalls(account, { owner: key, with: newPasskey() }))),
      "InvalidOptions"
    )
    // Kernel's key validator holds one key: it is replaced, never added to or removed.
    assert.strictEqual(
      reasonOf(await rejection(SmartAccount.addOwnerCalls(account, { owner: newOwner() }))),
      "OperationNotSupported"
    )
    assert.strictEqual(
      reasonOf(await rejection(SmartAccount.removeOwnerCalls(account, { owner: key }))),
      "OperationNotSupported"
    )
    assert.strictEqual(
      reasonOf(await rejection(SmartAccount.setThresholdCalls(account, { threshold: 1 }))),
      "OperationNotSupported"
    )
  })

  it("reads an EIP-7702 account's own key as its owner, and refuses to replace it", async () => {
    const owner = newOwner()
    const account = await KernelAccount.fromEip7702({ client, owner })
    await devnet.fund(owner.address)
    await devnet.sendUserOperation(account, [{ to: zeroAddress }])

    assert.deepStrictEqual(await SmartAccount.getOwners(client, { address: owner.address }), [
      { type: "key", validator: owner.address, owners: [owner.address], threshold: 1 }
    ])
    assert.strictEqual(
      reasonOf(await rejection(SmartAccount.replaceOwnerCalls(account, { owner, with: newOwner() }))),
      "OperationNotSupported"
    )
  })
})
