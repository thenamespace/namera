import defineNodeVitestConfig from "klarity/vitest/node";

export default defineNodeVitestConfig({
  resolve: {
    conditions: ["namera-source"],
  },
  ssr: {
    noExternal: [/^@namera-ai\//],
    resolve: {
      conditions: ["namera-source"],
      externalConditions: ["namera-source", "node"],
    },
  },
  test: {
    hookTimeout: 30_000,
    server: {
      deps: {
        inline: [/^@namera-ai\//],
      },
    },
    sequence: {
      concurrent: false,
    },
  },
});
