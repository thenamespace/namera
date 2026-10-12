import defineNodeVitestConfig from "klarity/vitest/node";

export default defineNodeVitestConfig({
  // Unit tests must not depend on a developer's local application configuration.
  envDir: false,
  resolve: { conditions: ["namera-source"], tsconfigPaths: true },
  ssr: {
    noExternal: [/^@namera-ai\//],
    resolve: { conditions: ["namera-source"], externalConditions: ["namera-source", "node"] },
  },
  test: {
    maxWorkers: 2,
    server: { deps: { inline: [/^@namera-ai\//] } },
  },
});
