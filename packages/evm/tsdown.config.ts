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
    chains: "src/chains/index.ts",
    "session-review": "src/sessions/review.ts",
  },
  publint: "ci-only",
  unbundle: true,
}) as UserConfig;
