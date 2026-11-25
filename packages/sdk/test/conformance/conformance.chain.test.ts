import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { KernelAccount, SmartAccount } from "@namera-ai/sdk"
import * as PromiseApi from "@namera-ai/sdk"
import * as PromiseBrowser from "@namera-ai/sdk/browser"
import * as EffectApi from "@namera-ai/sdk/effect"
import * as EffectBrowser from "@namera-ai/sdk/effect/browser"
import * as EffectNode from "@namera-ai/sdk/effect/node"
import * as PromiseNode from "@namera-ai/sdk/node"
import { Cause, Effect, Exit } from "effect"
import { http, zeroAddress } from "viem"
import { createBundlerClient } from "viem/account-abstraction"

import { client, devnet, newOwner } from "../accounts/accounts.test-utils.ts"
import { table } from "./table.ts"

const exportsOf = (api: Record<string, unknown>) =>
  Object.entries(api).flatMap(([module, members]) =>
    Object.entries(members as Record<string, unknown>).map(([name, value]) => [`${module}.${name}`, value] as const)
  )

// Services and their layers exist only in the Effect API: a Promise has no context to provide them in.
const effectOnly = {
  root: ["Keystore.CurrentKeystore", "Keystore.layer", "Keystore.layerEncryptedJson", "Keystore.layerMemory"],
  node: ["Keystore.layerFile", "Keystore.layerOsKeychain"],
  browser: ["Keystore.layerWebCrypto"]
}

const namesOf = (api: Record<string, unknown>, without: ReadonlyArray<string> = []) =>
  exportsOf(api).map(([name]) => name).filter((name) => !without.includes(name)).sort()

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
  devnet.isolate({ beforeEach, afterEach })

  it("export the same modules and names, besides the Effect API's services and layers", () => {
    assert.deepStrictEqual(namesOf(EffectApi, effectOnly.root), namesOf(PromiseApi))
    assert.deepStrictEqual(namesOf(EffectNode, effectOnly.node), namesOf(PromiseNode))
    assert.deepStrictEqual(namesOf(EffectBrowser, effectOnly.browser), namesOf(PromiseBrowser))
  })

  it("share every export that has no conformance row", () => {
    const promise = new Map(exportsOf(PromiseApi))
    const differing = exportsOf(EffectApi)
      .filter(([name, value]) => !effectOnly.root.includes(name) && promise.get(name) !== value)
      .map(([name]) => name)

    assert.deepStrictEqual(differing.sort(), Object.keys(table).sort())
    for (const [effect, promise] of [[EffectNode, PromiseNode], [EffectBrowser, PromiseBrowser]] as const) {
      const shared = new Map(exportsOf(promise))
      for (const [name, value] of exportsOf(effect)) {
        if (shared.has(name)) assert.strictEqual(value, shared.get(name), name)
      }
    }
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
    await devnet.fund(account.address)
    await devnet.sendUserOperation(account, [{ to: zeroAddress }])

    // alto bundles manually, so the operation waits for its receipt until the test aborts at the first receipt request.
    const controller = new AbortController()
    const bundler = createBundlerClient({
      account,
      client,
      pollingInterval: 50,
      transport: http(devnet.bundlerUrl, {
        onFetchRequest: async (request) => {
          if ((await request.clone().text()).includes("eth_getUserOperationReceipt")) {
            controller.abort(new Error("cancelled"))
          }
        }
      })
    })

    assert.strictEqual(
      await rejection(SmartAccount.installSessionsSync(bundler, { signal: controller.signal })),
      controller.signal.reason
    )
  })
})
