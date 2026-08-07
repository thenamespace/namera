import defineConfig from "klarity/tsdown/node";
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
  },
  publint: "ci-only",
  target: "node24.14",
  unbundle: true,
}) as UserConfig;
