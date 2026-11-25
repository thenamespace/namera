import { assert, describe, it } from "@effect/vitest"

import { appMeasurement, declaresNoSideEffects, fixtureMeasurement } from "../commands/bundleSize.ts"

describe("declaresNoSideEffects", () => {
  it("accepts false and an empty list", () => {
    assert.isTrue(declaresNoSideEffects(false))
    assert.isTrue(declaresNoSideEffects([]))
  })

  it("rejects a missing field and listed side-effectful files", () => {
    assert.isFalse(declaresNoSideEffects(undefined))
    assert.isFalse(declaresNoSideEffects(["./src/polyfill.ts"]))
  })
})

describe("fixtureMeasurement", () => {
  it("fails only over the budget", () => {
    assert.isFalse(fixtureMeasurement("Session.ts rollup", 2048, 2048).over)
    assert.isTrue(fixtureMeasurement("Session.ts rollup", 2049, 2048).over)
  })
})

describe("appMeasurement", () => {
  it("budgets the app's size over the viem-only app", () => {
    const measurement = appMeasurement("agentApp.ts", { app: 5120, viem: 4096 }, 1024)

    assert.isFalse(measurement.over)
    assert.strictEqual(measurement.line, "agentApp.ts: 5.00 KB gzip, 1.00 KB over viem (budget 1.00 KB)")
  })

  it("fails when the app's share grows, whatever viem weighs", () => {
    assert.isTrue(appMeasurement("agentApp.ts", { app: 2049, viem: 1024 }, 1024).over)
    assert.isFalse(appMeasurement("agentApp.ts", { app: 9216, viem: 8192 }, 1024).over)
  })
})
