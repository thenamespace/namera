import { describe, expect, it } from "vitest";

import pkg from "../package.json" with { type: "json" };
import { version } from "../src/index.ts";

describe("@namera-ai/sdk", () => {
  it("exports the package version", () => {
    expect(version).toBe(pkg.version);
  });
});
