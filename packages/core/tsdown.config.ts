import { createTsdownConfig } from "@namera-ai/config/tsdown";

export default createTsdownConfig({
  entry: ["src/index.ts"],
  external: ["viem"],
  platform: "neutral",
});
