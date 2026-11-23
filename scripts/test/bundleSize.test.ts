import { assert, describe, it } from "@effect/vitest"

import { declaresNoSideEffects } from "../commands/bundleSize.ts"

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
