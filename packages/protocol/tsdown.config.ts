import defineConfig from "klarity/tsdown/library";
import type { UserConfig } from "tsdown";

export default defineConfig({
  alias: {
    "#/": "./src/",
  },
  exports: {
    devExports: "@namera-ai/source",
  },
  publint: false,
  entry: {
    index: "src/index.ts",
    model: "src/model/index.ts",
  },
}) as UserConfig;
