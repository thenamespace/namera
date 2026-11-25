import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { Grant, Policy, Session, SessionKey } from "@namera-ai/sdk"
import { Effect, Schema } from "effect"
import { encodeFunctionData, type Hex, parseAbi } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

import { client, devnet } from "./accounts/accounts.test-utils.ts"
import { deployedAccount } from "./session.test-utils.ts"

// The evaluator against the contracts: for generated batches of calls (around each condition's and budget's
// boundaries), `Grant.check`'s verdict is the chain's: an operation it passes is included, one it refuses is refused
// by the bundler's validation. Runs one after another on one account, so budgets fill up across a property's runs.

const token = privateKeyToAccount(generatePrivateKey()).address
const recipient = privateKeyToAccount(generatePrivateKey()).address
const payee = privateKeyToAccount(generatePrivateKey()).address
const stranger = privateKeyToAccount(generatePrivateKey()).address
const erc20 = parseAbi(["function transfer(address to, uint256 amount)", "function approve(address, uint256)"])

const transfer = (to: Hex, amount: bigint) => ({
  to: token,
  data: encodeFunctionData({ abi: erc20, functionName: "transfer", args: [to, amount] })
})
const pay = (to: Hex, value: bigint) => ({ to, value, data: "0x" as Hex })

// Mostly calls the conditions allow, so budgets fill up across a property's runs, and some just outside a condition
// or that nothing allows.
const candidates = [
  transfer(recipient, 0n),
  transfer(recipient, 50n),
  transfer(recipient, 75n),
  transfer(recipient, 100n),
  pay(payee, 400n),
  pay(payee, 800n),
  pay(payee, 1000n),
  transfer(recipient, 101n),
  transfer(stranger, 1n),
  pay(payee, 1001n),
  pay(stranger, 1n),
  { to: stranger, data: "0x12345678" as Hex },
  { to: token, data: encodeFunctionData({ abi: erc20, functionName: "approve", args: [recipient, 1n] }) }
] as const
const allowed = Schema.Literals([0, 1, 2, 3, 4, 5, 6])
const any = Schema.Literals([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

describe("the evaluator on a Kernel account", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  // The session's first operation (ENABLE mode, the slowest for the bundler to simulate) runs before each property.
  let grant: Grant.Grant
  let agent: Awaited<ReturnType<typeof Grant.toAccount>>
  beforeEach(async () => {
    const sessionKey = privateKeyToAccount(generatePrivateKey())
    const session = Session.from({
      signer: SessionKey.ecdsa(sessionKey.address),
      validUntil: Session.now() + 30 * 86400,
      policies: [
        Policy.erc20Transfer({ token, to: [recipient], amount: { lte: 100n } }),
        Policy.nativeTransfer({ to: [payee], value: { lte: 1000n } }),
        Policy.spend({ token, amount: 150n, period: "day" }),
        Policy.value({ amount: 1500n, period: "day" }),
        Policy.gas({ maxCost: 10n ** 18n, period: "lifetime" })
      ]
    })
    grant = await Grant.create({ account: await deployedAccount(), session })
    agent = await Grant.toAccount(client, { grant, signer: sessionKey, check: false })
    const { success } = await devnet.sendUserOperation(agent, [transfer(recipient, 1n)])
    assert.isTrue(success)
  })

  // A few short properties with their own seeds, so each stays within the test time limit: the bundler simulates and
  // traces each operation.
  for (const seed of [12, 34, 56, 78, 90]) {
    it.effect.prop(`agrees with the chain on what is included (seed ${seed})`, {
      first: allowed,
      second: any,
      alone: Schema.Boolean
    }, ({ alone, first, second }) =>
      Effect.promise(async () => {
        const calls = alone ? [candidates[first]] : [candidates[first], candidates[second]]
        const { violations } = await Grant.check(client, { grant, calls })

        const bundler = devnet.bundlerClient(agent)
        const included = await bundler.sendUserOperation({ calls: [...calls] }).then(
          async (hash) => {
            await devnet.sendBundleNow()
            return (await bundler.waitForUserOperationReceipt({ hash })).success
          },
          (error: unknown) => {
            assert.match(String(error), /AA2|validateUserOp|reverted/)
            return false
          }
        )
        assert.strictEqual(
          violations.length === 0,
          included,
          `calls ${alone ? first : `${first}, ${second}`}: ${violations.map((violation) => violation._tag).join(", ")}`
        )
      }), { arbitrary: { runs: 3, seed } })
  }
})
