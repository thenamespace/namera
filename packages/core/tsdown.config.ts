import { createTsdownConfig } from "@namera-ai/config/tsdown";
import type { UserConfig } from "tsdown";

const config: UserConfig = createTsdownConfig({
  entry: {
    account: "./src/account/index.ts",
    policy: "./src/policy/index.ts",
    "session-key": "./src/session-key/index.ts",
    types: "./src/types/index.ts",
  },
  platform: "neutral",
});
export default config;
