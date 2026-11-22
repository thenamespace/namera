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
    setupFiles: [path.join(import.meta.dirname, "vitest.setup.ts")],
    sequence: {
      concurrent: true
    },
    include: ["test/**/*.test.ts"],
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
        include: ["test/runtime/Runtime.test.ts"],
        browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: "chromium" }] }
      }
    })
  ]
  : []

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      project("@namera-ai/contracts", "packages/contracts"),
      project("@namera-ai/sdk", "packages/sdk", { test: { globalSetup: ["test/setup/chain.ts"] } }),
      project("@namera-ai/tools", "tools/cli"),
      project("@namera-ai/oxc", "tools/oxc"),
      ...runtimeTests
    ]
  }
})
