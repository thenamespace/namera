import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { AccountError, KernelAccount, NexusAccount, Safe7579Account, SmartAccount } from "@namera-ai/sdk"
import { parseAbi, zeroAddress } from "viem"
import type { WebAuthnAccount } from "viem/account-abstraction"

import { client, devnet, newOwner } from "./accounts.test-utils.ts"
import { newPasskey } from "./passkey.test-utils.ts"

type Type = "kernel" | "nexus" | "safe7579"
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

// Nexus and Safe7579 deploy through unstaked factories, so the devnet deploys them first (see Devnet.deploy).
const build = async (type: Type, owner: Owner | WebAuthnAccount | SmartAccount.Passkeys) => {
  const passkeys = "passkeys" in owner ? owner.passkeys : undefined
  const account = type === "kernel"
    ? await KernelAccount.from({ client, owner })
    : type === "nexus"
    ? await NexusAccount.from({ client, owner })
    : await Safe7579Account.from({
      client,
      owners: passkeys ?? [owner as Owner | WebAuthnAccount] as never,
      threshold: "passkeys" in owner ? owner.threshold : undefined
    })
  await devnet.fund(account.address)
  if (type === "kernel") await devnet.sendUserOperation(account, [{ to: zeroAddress }])
  else await devnet.deploy(account)
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

const safeOwners = (address: `0x${string}`) =>
  client.readContract({
    address,
    abi: parseAbi(["function getOwners() view returns (address[])"]),
    functionName: "getOwners"
  })

describe.each(["kernel", "nexus", "safe7579"] as const)("owners of a %s account", { concurrent: false }, (type) => {
  devnet.isolate({ beforeEach, afterEach })

  it("reads its key owner or its passkeys, and nothing before deployment", async () => {
    const key = newOwner()
    const passkey = newPasskey()
    const [keyed, passkeyed] = [await build(type, key), await build(type, passkey)]

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

    const undeployed = type === "kernel"
      ? await KernelAccount.from({ client, owner: newOwner() })
      : type === "nexus"
      ? await NexusAccount.from({ client, owner: newOwner() })
      : await Safe7579Account.from({ client, owners: [newOwner()] })
    assert.deepStrictEqual(await SmartAccount.getOwners(client, { address: undeployed.address }), [])
    assert.strictEqual(
      reasonOf(await rejection(SmartAccount.addOwnerCalls(undeployed, { owner: newPasskey() }))),
      "OperationNotSupported"
    )
  })

  it("adds a passkey that then signs, and raises the threshold to need both", async () => {
    const [first, second] = [newPasskey(), newPasskey()]
    const account = await build(type, first)

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
    const account = await build(type, { passkeys: [first, second], threshold: 1 })

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
    const passkeyed = await build(type, passkey)
    await SmartAccount.replaceOwnerSync(bundler(passkeyed), { owner: passkey, with: replacement })
    await fails(await as(passkeyed, passkey))
    assert.isTrue(await sends(await as(passkeyed, replacement)))

    const [key, next] = [newOwner(), newOwner()]
    const keyed = await build(type, key)
    await SmartAccount.replaceOwnerSync(bundler(keyed), { owner: key, with: next })
    await fails(await as(keyed, key))
    assert.isTrue(await sends(await as(keyed, next)))
    const [set] = await SmartAccount.getOwners(client, { address: keyed.address })
    assert.deepStrictEqual(set?.type === "key" ? set.owners : [], [next.address])
    if (type === "safe7579") assert.deepStrictEqual(await safeOwners(keyed.address), [next.address])
  })

  it("adds passkeys to an account owned by a key, and a key to one owned by passkeys", async () => {
    const key = newOwner()
    const passkey = newPasskey()
    const keyed = await build(type, key)
    await SmartAccount.addOwnerValidatorSync(bundler(keyed), { owner: passkey })
    assert.isTrue(await sends(await as(keyed, passkey)))
    assert.isTrue(await sends(await as(keyed, key)))
    assert.deepStrictEqual(
      (await SmartAccount.getOwners(client, { address: keyed.address })).map(({ type }) => type),
      ["key", "passkey"]
    )

    const other = newOwner()
    const passkeyed = await build(type, newPasskey())
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
    const account = await build(type, key)

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
    if (type === "safe7579") {
      assert.strictEqual(reasonOf(await rejection(SmartAccount.addOwnerCalls(account, { owner: key }))), "OwnerExists")
      assert.strictEqual(
        reasonOf(await rejection(SmartAccount.setThresholdCalls(account, { threshold: 2 }))),
        "ThresholdUnreachable"
      )
    } else {
      assert.strictEqual(
        reasonOf(await rejection(SmartAccount.addOwnerCalls(account, { owner: newOwner() }))),
        "OperationNotSupported"
      )
      assert.strictEqual(
        reasonOf(await rejection(SmartAccount.setThresholdCalls(account, { threshold: 1 }))),
        "OperationNotSupported"
      )
    }
  })
})

describe("key owners of a Safe7579 account", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  it("change on OwnableValidator and on the Safe together, so a removed key can't execute through the Safe", async () => {
    const [first, second] = [newOwner(), newOwner()]
    const account = await build("safe7579", first)

    await SmartAccount.addOwnerSync(bundler(account), { owner: second.address })
    assert.sameMembers([...await safeOwners(account.address)], [first.address, second.address])
    await SmartAccount.setThresholdSync(bundler(account), { threshold: 2 })
    const [set] = await SmartAccount.getOwners(client, { address: account.address })
    assert.strictEqual(set?.threshold, 2)
    assert.strictEqual(
      await client.readContract({
        address: account.address,
        abi: parseAbi(["function getThreshold() view returns (uint256)"]),
        functionName: "getThreshold"
      }),
      2n
    )

    const both = await SmartAccount.fromAddress({ client, address: account.address, owners: [first, second] })
    await SmartAccount.setThresholdSync(bundler(both), { threshold: 1 })
    await SmartAccount.removeOwnerSync(bundler(await as(account, second)), { owner: first })
    assert.deepStrictEqual(await safeOwners(account.address), [second.address])
    await fails(await as(account, first))
    assert.isTrue(await sends(await as(account, second)))
  })
})
