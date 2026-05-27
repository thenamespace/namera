import { createTsdownConfig } from "@namera-ai/config/tsdown";

export default createTsdownConfig({
  entry: {
    index: "./src/index.ts",
    database: "./src/database/index.ts",
    dto: "./src/dto/index.ts",
  },
});
