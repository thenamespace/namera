import { assert, describe, it } from "@effect/vitest"

import { expected, smoke } from "./smoke.test-utils.ts"

describe("the SDK on this runtime", () => {
  it("keeps its clock, errors, Schema encoding and Effect API working", async () => {
    assert.deepStrictEqual(await smoke(), expected)
  })
})
