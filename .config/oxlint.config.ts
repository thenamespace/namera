import config from "klarity/oxlint/node";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [config],
  ignorePatterns: ["**/contracts/dependencies/**", "**/contracts/out/**"],
  overrides: [
    {
      // Command-line scripts report to the terminal.
      files: ["**/contracts/script/**/*.ts"],
      rules: { "no-console": "off" },
    },
  ],
});
