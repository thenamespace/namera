import { assert, describe, it } from "@effect/vitest"

import { enableStripInternal } from "../commands/stripInternal.ts"

describe("enableStripInternal", () => {
  it("turns stripInternal on", () => {
    assert.strictEqual(
      enableStripInternal(`{ "compilerOptions": { "stripInternal": false } }`),
      `{ "compilerOptions": { "stripInternal": true } }`
    )
  })

  it("is undefined when the option is missing or already on", () => {
    assert.isUndefined(enableStripInternal(`{ "compilerOptions": { "stripInternal": true } }`))
  })
})
