import defineConfig from "klarity/tsdown/library";
import type { UserConfig } from "tsdown";

export default defineConfig({
  alias: {
    "#/": "./src/",
  },
  // Preserve separate Node and browser entry points and the Node-only storage export.
  exports: false,
  deps: { neverBundle: [/^node:/] },
  attw: {
    enabled: "ci-only",
    level: "error",
    profile: "esm-only",
  },
  entry: {
    index: "src/index.ts",
    "index.node": "src/index.node.ts",
    node: "src/node/index.ts",
  },
  publint: "ci-only",
  unbundle: true,
}) as UserConfig;
