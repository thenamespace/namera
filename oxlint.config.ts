import config from "klarity/oxlint/react";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [config],
  overrides: [
    {
      // Row handlers built inside a .map() cannot be memoized without wrapping
      // every row in its own component, which buys nothing for an operator tool
      // whose tables are capped at 100 rows. Correctness and accessibility rules
      // stay active.
      files: ["apps/admin-portal/src/**/*.tsx"],
      rules: {
        "react-perf/jsx-no-new-object-as-prop": "off",
        "react-perf/jsx-no-new-array-as-prop": "off",
        "react-perf/jsx-no-new-function-as-prop": "off",
        "react-perf/jsx-no-jsx-as-prop": "off",
      },
    },
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
