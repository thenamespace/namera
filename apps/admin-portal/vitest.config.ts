import defineNodeVitestConfig from "klarity/vitest/node";

export default defineNodeVitestConfig({
  envDir: false,
  resolve: { conditions: ["namera-source"], tsconfigPaths: true },
  ssr: {
    noExternal: [/^@namera-ai\//],
    resolve: { conditions: ["namera-source"], externalConditions: ["namera-source", "node"] },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    maxWorkers: 2,
    server: { deps: { inline: [/^@namera-ai\//] } },
  },
});
