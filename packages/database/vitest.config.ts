import defineNodeVitestConfig from "klarity/vitest/node";

export default defineNodeVitestConfig({
  resolve: {
    conditions: ["namera-source"],
  },
  test: {
    sequence: {
      concurrent: false,
    },
  },
});
