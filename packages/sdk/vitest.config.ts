import { defineVitestConfig } from "klarity/vitest";

export default defineVitestConfig({
  test: { include: ["test/**/*.test.ts"] },
});
