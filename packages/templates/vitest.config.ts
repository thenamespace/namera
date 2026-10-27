import defineNodeVitestConfig from "klarity/vitest/node";

export default defineNodeVitestConfig({
  test: { maxWorkers: 2 },
  resolve: { conditions: ["namera-source"] },
});
