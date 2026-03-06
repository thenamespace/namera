import { createTsdownConfig } from "@repo/config/tsdown";

export default createTsdownConfig({
  entry: ["src/index.ts"],
  platform: "neutral",
});
