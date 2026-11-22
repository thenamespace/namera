import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { Account, KernelAccount } from "@namera-ai/sdk"
import * as PromiseApi from "@namera-ai/sdk"
import * as EffectApi from "@namera-ai/sdk/effect"
import { Cause, Effect, Exit } from "effect"
import { http, zeroAddress } from "viem"
import { createBundlerClient } from "viem/account-abstraction"

import { chain, client, fund, isolate, newOwner, send } from "../accounts/accounts.test-utils.ts"
import { table } from "./table.ts"

const exportsOf = (api: Record<string, unknown>) =>
  Object.entries(api).flatMap(([module, members]) =>
    Object.entries(members as Record<string, unknown>).map(([name, value]) => [`${module}.${name}`, value] as const)
  )

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected the promise to reject"),
    (error: unknown) => error
  )

// What makes two failures the same to a caller: the family, the reason and the message.
const identity = (error: unknown) => {
  const { _tag, message, reason } = error as { _tag?: string; message?: string; reason?: { _tag?: string } }
  return { _tag, reason: reason?._tag, message }
}

describe("the Promise and Effect APIs", { concurrent: false }, () => {
  isolate({ beforeEach, afterEach })

  it("export the same modules and names", () => {
    assert.deepStrictEqual(
      exportsOf(EffectApi).map(([name]) => name).sort(),
      exportsOf(PromiseApi).map(([name]) => name).sort()
    )
  })

  it("share every export that has no conformance row", () => {
    const promise = new Map(exportsOf(PromiseApi))
    const differing = exportsOf(EffectApi).filter(([name, value]) => promise.get(name) !== value).map(([name]) => name)

    assert.deepStrictEqual(differing.sort(), Object.keys(table).sort())
  })

  for (const [name, row] of Object.entries(table)) {
    if (row.kind === "sync") {
      it(`agree on ${name}`, row.check)
      continue
    }

    it(`agree on ${name}: the same failure, and an abort before the call rejects with its reason`, async () => {
      const exit = await Effect.runPromiseExit(row.failure.effect())
      assert.isTrue(Exit.isFailure(exit))
      const effectError = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined
      assert.deepStrictEqual(identity(await rejection(row.failure.promise())), identity(effectError))

      const controller = new AbortController()
      controller.abort(new Error("cancelled"))
      assert.strictEqual(await rejection(row.failure.promise(controller.signal)), controller.signal.reason)
    })

    const { success } = row
    if (success !== undefined) {
      it(`agree on ${name}: the same value`, async () => {
        const project = success.project ?? ((value: unknown) => value)
        assert.deepStrictEqual(project(await success.promise()), project(await Effect.runPromise(success.effect())))
      })
    }
  }

  it("reject with the signal's reason when aborted mid-flight", async () => {
    const account = await KernelAccount.from({ client, owner: newOwner(), sessions: false })
    await fund(account.address)
    await send(account, [{ to: zeroAddress }])

    // alto bundles manually, so the operation waits for its receipt until the test aborts at the first receipt request.
    const controller = new AbortController()
    const bundler = createBundlerClient({
      account,
      client,
      pollingInterval: 50,
      transport: http(chain.bundlerUrl, {
        onFetchRequest: async (request) => {
          if ((await request.clone().text()).includes("eth_getUserOperationReceipt")) {
            controller.abort(new Error("cancelled"))
          }
        }
      })
    })

    assert.strictEqual(
      await rejection(Account.installSessionsSync(bundler, { signal: controller.signal })),
      controller.signal.reason
    )
  })
})
