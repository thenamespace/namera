import { assert, describe, it } from "@effect/vitest"

import { renderApiReport } from "../commands/apiSnapshot.ts"

describe("renderApiReport", () => {
  it("lists declarations sorted by file, without source map comments", () => {
    const report = renderApiReport("@scope/pkg", [
      { file: "b.d.ts", source: "export declare const b: 2;\n//# sourceMappingURL=b.d.ts.map\n" },
      { file: "a.d.ts", source: "export declare const a: 1;\n" }
    ])

    assert.isTrue(report.startsWith("# API report for `@scope/pkg`\n"))
    assert.isBelow(report.indexOf("## a.d.ts"), report.indexOf("## b.d.ts"))
    assert.include(report, "```ts\nexport declare const b: 2;\n```")
    assert.notInclude(report, "sourceMappingURL")
  })
})
