import { fileURLToPath } from "node:url";

import { Struct } from "effect";

import defineConfig from "klarity/vitest/node";

const config = defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  resolve: { conditions: ["workspace-source"] },
  ssr: { resolve: { conditions: ["workspace-source"] } },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: { name: "contracts", root: "packages/contracts", include: ["test/**/*.test.ts"] },
      },
      {
        extends: true,
        test: { name: "tools", root: "tools/cli", include: ["src/**/*.test.ts"] },
      },
    ],
  },
});

// WARNING: klarity raises testTimeout to 10s; omitting it keeps Vitest's 5s default (no-flake-masking).
export default { ...config, test: Struct.omit(config.test ?? {}, ["testTimeout"]) };
