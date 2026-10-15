import defineConfig from "klarity/vitest/node";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
});
