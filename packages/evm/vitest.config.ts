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
    // Fork suites advance one shared Anvil clock; parallel files can expire
    // another suite's authorization while it is being exercised.
    fileParallelism: process.env.NAMERA_TEST_ANVIL_URL === undefined,
    server: {
      deps: {
        inline: [/^@namera-ai\//],
      },
    },
  },
});
