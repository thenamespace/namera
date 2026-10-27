import defineConfig from "klarity/tsdown/library";
import type { UserConfig } from "tsdown";

export default defineConfig({
  alias: { "#/": "./src/" },
  exports: { devExports: "namera-source" },
  entry: { index: "src/index.ts" },
  unbundle: true,
}) as UserConfig;
