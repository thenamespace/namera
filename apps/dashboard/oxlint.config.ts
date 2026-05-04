import { baseOxLintConfig } from "@namera-ai/config/oxc/base";

export default {
  ignorePatterns: ["src/route-tree.gen.ts"],
  ...baseOxLintConfig,
};
