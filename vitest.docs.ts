import * as Doctest from "@effect/doctest/Plugin"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [Doctest.plugin()],
  test: {
    passWithNoTests: true,
    include: [],
    includeSource: ["packages/*/src/**/*.ts"]
  }
})
