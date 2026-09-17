import defineNodeVitestConfig from "klarity/vitest/node";

export default defineNodeVitestConfig({
  resolve: { conditions: ["namera-source"] },
  ssr: {
    noExternal: [/^@namera-ai\//],
    resolve: {
      conditions: ["namera-source"],
      externalConditions: ["namera-source", "node"],
    },
  },
  test: {
    // Crypto-heavy keystore tests compete with cold CLI subprocess startup.
    fileParallelism: false,
    server: { deps: { inline: [/^@namera-ai\//] } },
  },
});
