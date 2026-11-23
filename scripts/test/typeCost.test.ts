import { assert, describe, it } from "@effect/vitest"

import { parseInstantiations, withinBudget } from "../commands/typeCost.ts"

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
