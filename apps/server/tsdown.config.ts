import { createTsdownConfig } from "@namera-ai/config/tsdown";

export default createTsdownConfig({
  deps: {
    alwaysBundle: [/^@namera-ai\//],
  },
  entry: {
    index: "./src/index.ts",
  },
});
