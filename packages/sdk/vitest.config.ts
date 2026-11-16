import { defineVitestConfig } from "klarity/vitest";

export default defineVitestConfig({
  resolve: { conditions: ["workspace-source"] },
  test: { include: ["test/**/*.test.ts"] },
});
