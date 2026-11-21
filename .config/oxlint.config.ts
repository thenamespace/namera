import { presets } from "@effect/tsgo/oxlint-presets";

import landmines from "@interfere/landmines/configs/recommended.json" with { type: "json" };
import config from "klarity/oxlint";
import { defineConfig } from "oxlint";

// WARNING: the Effect presets and type-aware rules need `effect-tsgo patch --oxlint` (run by `prepare`).
export default defineConfig({
  extends: [
    config,
    presets.correctness,
    presets.antipattern,
    presets.effectNative,
    presets.style,
    presets.maintainers,
    landmines,
  ],
  ignorePatterns: [
    "**/routeTree.gen.ts",
    "**/.output/**",
    "**/.nitro/**",
    "**/.tanstack/**",
    "**/contracts/dependencies/**",
    "**/contracts/out/**",
  ],
  rules: {
    "no-underscore-dangle": ["error", { allow: ["_tag"] }],
  },
  overrides: [
    {
      files: ["**/test/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          { paths: [{ name: "vitest", message: "Import from @effect/vitest instead." }] },
        ],
      },
    },
    {
      files: ["**/src/internal/**", "**/test/**", "**/tools/**"],
      rules: { "effecttsgo/api-stability-leak": "off" },
    },
    {
      files: ["**/tools/**"],
      rules: { "effecttsgo/missing-pipeable-signature": "off" },
    },
  ],
});
