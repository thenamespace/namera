import * as path from "node:path"
import { defineConfig } from "vitest/config"

// Stryker's test run: the tests that cover src/internal/core. The account encodings are proven on the test chain, so
// this config starts the devnet too. Run from this package.
export default defineConfig({
  // Tests load internal modules through the path aliases in tsconfig.tests.json, as in the root config.
  resolve: { tsconfigPaths: true },
  test: {
    include: [
      "test/Session.test.ts",
      "test/conformance/**/*.test.ts",
      "test/runtime/Runtime.test.ts",
      "test/accounts/**/*.test.ts",
      "test/keys/**/*.test.ts"
    ],
    globalSetup: ["test/setup/devnet.ts"],
    setupFiles: [path.join(import.meta.dirname, "../../vitest.setup.ts")]
  }
})
