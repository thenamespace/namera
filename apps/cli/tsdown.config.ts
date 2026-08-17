import defineConfig from "klarity/tsdown/node";
import type { UserConfig } from "tsdown";

export default defineConfig({
  alias: {
    "#/": "./src/",
  },
  dts: false,
  entry: {
    index: "src/index.ts",
  },
  exports: false,
  publint: false,
  target: "node24.14",
}) as UserConfig;
