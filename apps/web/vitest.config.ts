import defineConfig from "klarity/vitest/node";

export default defineConfig({
  resolve: { conditions: ["namera-source"] },
  ssr: {
    noExternal: [/^@namera-ai\//],
    resolve: {
      conditions: ["namera-source"],
      externalConditions: ["namera-source", "node"],
    },
  },
  test: { server: { deps: { inline: [/^@namera-ai\//] } } },
});
