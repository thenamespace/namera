import { createTsdownConfig } from "@repo/config/tsdown";

export default createTsdownConfig({
  entry: {
    base64: "src/base64.ts",
    hash: "src/hash.ts",
    index: "src/index.ts",
    random: "src/random.ts",
  },
});
