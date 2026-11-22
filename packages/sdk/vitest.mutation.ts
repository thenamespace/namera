import * as path from "node:path"
import { defineConfig } from "vitest/config"

// Stryker's test run: the tests that cover src/internal/core. The account encodings are proven on the test chain, so
// this config starts it too. Run from this package.
export default defineConfig({
  test: {
    include: [
      "test/Session.test.ts",
      "test/conformance/**/*.test.ts",
      "test/runtime/Runtime.test.ts",
      "test/accounts/**/*.test.ts"
    ],
    globalSetup: ["test/setup/chain.ts"],
    setupFiles: [path.join(import.meta.dirname, "../../vitest.setup.ts")]
  }
})
