import { assert, describe, it } from "@effect/vitest"
import * as PromiseApi from "@namera-ai/sdk"
import * as EffectApi from "@namera-ai/sdk/effect"

import { table } from "./table.ts"

const exportsOf = (api: Record<string, unknown>) =>
  Object.entries(api).flatMap(([module, members]) =>
    Object.entries(members as Record<string, unknown>).map(([name, value]) => [`${module}.${name}`, value] as const)
  )

describe("the Promise and Effect APIs", () => {
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

  for (const [name, { check }] of Object.entries(table)) {
    it(`agree on ${name}`, check)
  }
})
