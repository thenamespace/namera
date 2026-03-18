import { createTsdownConfig } from "@namera-ai/config/tsdown";

export default createTsdownConfig({
  banner: {
    js: "#!/usr/bin/env node",
  },
  entry: ["src/index.ts"],
  platform: "node",
});
