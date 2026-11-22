import * as path from "node:path"
import { defineConfig } from "vitest/config"

// Stryker's test run: the tests that cover src/internal/core, which needs no chain. Run from this package.
export default defineConfig({
  test: {
    include: ["test/Session.test.ts", "test/conformance/**/*.test.ts", "test/runtime/Runtime.test.ts"],
    setupFiles: [path.join(import.meta.dirname, "../../vitest.setup.ts")]
  }
})
