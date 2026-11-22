import { assert, describe, it } from "@effect/vitest"
import { execFileSync } from "node:child_process"
import * as Path from "node:path"

const root = Path.resolve(import.meta.dirname, "../../..")
const fixtures = Path.join(import.meta.dirname, "fixtures", "sdk")

type Report = { readonly diagnostics: ReadonlyArray<{ readonly code: string; readonly filename: string }> }

// Runs the real oxlint over the fixture package; it exits non-zero when it reports errors.
const lint = (): Report => {
  const args = ["exec", "oxlint", "-c", Path.join(fixtures, "oxlintrc.json"), "--format", "json", fixtures]
  try {
    return JSON.parse(execFileSync("pnpm", args, { cwd: root, encoding: "utf8" }))
  } catch (error) {
    return JSON.parse((error as { readonly stdout: string }).stdout)
  }
}

describe("the SDK lint rules", () => {
  it("fire on each violation in the fixture package and nowhere else", () => {
    const found = lint().diagnostics.map(({ code, filename }) =>
      `${Path.relative(fixtures, Path.resolve(root, filename))} ${code}`
    )

    assert.deepStrictEqual(found.sort(), [
      "src/Barrel.ts effect(no-import-from-barrel-package)",
      "src/Runner.ts namera(no-effect-run)",
      "src/Runner.ts namera(no-effect-run)",
      "src/effect/accounts/KernelAccount.ts namera(no-foreign-internal)",
      "src/internal/core/encoding.ts eslint(no-restricted-imports)",
      "src/keys/Key.ts namera(no-foreign-internal)"
    ])
  })
})
