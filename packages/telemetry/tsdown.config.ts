import defineConfig from "klarity/tsdown/library";
import type { UserConfig } from "tsdown";

export default defineConfig({
  alias: {
    "#/": "./src/",
  },
  exports: {
    devExports: "namera-source",
  },
  attw: {
    enabled: "ci-only",
    level: "error",
    profile: "esm-only",
  },
  entry: {
    index: "src/index.ts",
    "analytics/browser": "src/analytics/browser.ts",
    "analytics/contract": "src/analytics/contract.ts",
    "analytics/server": "src/analytics/server.ts",
  },
  publint: "ci-only",
  unbundle: true,
}) as UserConfig;
