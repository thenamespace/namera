import config from "klarity/oxlint/react";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [config],
  // Oxlint now includes React Compiler diagnostics. We do not enable the
  // compiler yet; surface its migration work without changing the existing lint gate.
  rules: {
    "react/capitalized-calls": "warn",
    "react/incompatible-library": "warn",
    "react/preserve-manual-memoization": "warn",
    "react/purity": "warn",
    "react/refs": "warn",
    "react/set-state-in-effect": "warn",
  },
  overrides: [
    {
      files: ["apps/web/**/*.tsx"],
      // Motion props, render slots, and native event handlers do not benefit from
      // blanket memoization. Keep React correctness and accessibility rules active.
      rules: {
        "react-perf/jsx-no-new-object-as-prop": "off",
        "react-perf/jsx-no-new-array-as-prop": "off",
        "react-perf/jsx-no-new-function-as-prop": "off",
        "react-perf/jsx-no-jsx-as-prop": "off",
      },
    },
  ],
});
