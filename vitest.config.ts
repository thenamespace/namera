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

const project = (name: string, directory: string, config: ViteUserConfig = {}) =>
  mergeConfig(shared, mergeConfig({ root: directory, test: { name } }, config))

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      project("@namera-ai/contracts", "packages/contracts"),
      project("@namera-ai/sdk", "packages/sdk", { test: { globalSetup: ["test/setup/chain.ts"] } }),
      project("@namera-ai/tools", "tools/cli"),
      project("@namera-ai/oxc", "tools/oxc")
    ]
  }
})
