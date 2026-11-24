import { playwright } from "@vitest/browser-playwright"
import * as path from "node:path"
import { defineConfig, mergeConfig, type ViteUserConfig } from "vitest/config"

export const exclude = [
  "**/.*/**",
  "**/node_modules/**",
  "**/dist/**",
  "**/benchmark/**",
  "**/typetest/**",
  "**/typeperf/**",
  "**/coverage/**",
  "**/test/fixtures/**",
  "**/*.d.ts",
  "**/*.config.*",
  "**/vitest.*"
]

const shared: ViteUserConfig = {
  // Tests load internal modules through the path aliases in tsconfig.tests.json, as in Effect.
  resolve: {
    tsconfigPaths: true
  },
  server: {
    watch: {
      ignored: exclude
    }
  },
  test: {
    exclude,
    passWithNoTests: true,
    // Chain tests send user operations that the bundler simulates and traces (an ENABLE operation takes seconds).
    testTimeout: 10_000,
    setupFiles: [path.join(import.meta.dirname, "vitest.setup.ts")],
    sequence: {
      concurrent: true
    },
    include: ["test/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["html", "text-summary"],
      reportsDirectory: "coverage",
      exclude
    }
  }
}

// `mergeConfig` concatenates arrays, so a project's own `include` replaces the shared one afterwards, as in Effect.
const project = (name: string, directory: string, config: ViteUserConfig = {}) => {
  const merged = mergeConfig(shared, mergeConfig({ root: directory, test: { name } }, config))
  if (config.test?.include !== undefined) merged.test!.include = [...config.test.include]
  return merged
}

// The runtime matrix (`NAMERA_RUNTIME_TESTS=1`): the SDK's smoke test alone, for Bun, Deno and older Node, and in
// Chromium. workerd runs in the default suite through Miniflare.
const runtimeTests = process.env["NAMERA_RUNTIME_TESTS"] === "1"
  ? [
    project("@namera-ai/sdk/runtime", "packages/sdk", { test: { include: ["test/runtime/Runtime.test.ts"] } }),
    project("@namera-ai/sdk/browser", "packages/sdk", {
      test: {
        include: ["test/runtime/Runtime.test.ts", "test/browser/**/*.test.ts"],
        browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: "chromium" }] }
      }
    })
  ]
  : []

export default defineConfig({
  test: {
    passWithNoTests: true,
    // Each chain test worker runs its own anvil and alto (two pairs for multichain tests): with a worker per core,
    // they compete with the tests for CPU and heavy chain tests time out. At half the cores, the bundler's tracing still
    // slowed tests fivefold under load; 40% keeps them under the limit.
    maxWorkers: "40%",
    projects: [
      project("scripts", "scripts"),
      project("@namera-ai/contracts", "packages/contracts"),
      project("@namera-ai/devnet", "packages/devnet", { test: { globalSetup: ["test/setup/devnet.ts"] } }),
      // The SDK's unit tests need no chain; `*.chain.test.ts` run against the devnet.
      // `test/browser/` needs a browser (IndexedDB) and runs in the Chromium project of the runtime matrix.
      project("@namera-ai/sdk", "packages/sdk", {
        test: { exclude: [...exclude, "**/*.chain.test.ts", "test/browser/**"] }
      }),
      project("@namera-ai/sdk/chain", "packages/sdk", {
        test: { include: ["test/**/*.chain.test.ts"], globalSetup: ["test/setup/devnet.ts"] }
      }),
      ...runtimeTests
    ]
  }
})
