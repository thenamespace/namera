import { assert, describe, it } from "@effect/vitest"

import { appMeasurement, parseInstantiations, updatedBaseline, withinBudget } from "../commands/typeCost.ts"

describe("parseInstantiations", () => {
  it("reads the count from tsc's extended diagnostics", () => {
    assert.strictEqual(parseInstantiations("Types:   120\nInstantiations:   4521\nMemory used: 1K\n"), 4521)
  })

  it("is undefined when tsc reports no count", () => {
    assert.isUndefined(parseInstantiations("error TS2307: Cannot find module"))
  })
})

describe("withinBudget", () => {
  it("allows up to 20% over the baseline", () => {
    assert.isTrue(withinBudget(1200, 1000))
    assert.isFalse(withinBudget(1201, 1000))
  })
})

describe("appMeasurement", () => {
  it("checks the app's count over its viem-only twin against the baseline", () => {
    const measurement = appMeasurement("owner.ts", { app: 31000, viem: 29000 }, 2000)

    assert.isFalse(measurement.over)
    assert.strictEqual(measurement.line, "owner.ts: 31000 instantiations, 2000 over viem (baseline 2000)")
  })

  it("fails when the share grows more than 20%, whatever viem costs", () => {
    assert.isTrue(appMeasurement("owner.ts", { app: 31401, viem: 29000 }, 2000).over)
    assert.isFalse(appMeasurement("owner.ts", { app: 42000, viem: 40000 }, 2000).over)
  })
})

describe("updatedBaseline", () => {
  it("records consumers' counts and apps' shares over viem", () => {
    const counts = new Map([["consumer.ts", 4400], ["viem.ts", 29000], ["owner.ts", 31500]])
    const current = { consumers: { "consumer.ts": 1 }, apps: { viem: "viem.ts", baselines: { "owner.ts": 1 } } }

    assert.deepStrictEqual(updatedBaseline(current, counts), {
      consumers: { "consumer.ts": 4400 },
      apps: { viem: "viem.ts", baselines: { "owner.ts": 2500 } }
    })
  })
})
