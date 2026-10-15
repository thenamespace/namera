import { fumadocsMdx } from "fumadocs-mdx/vite";
import defineConfig from "klarity/vitest/node";

export default defineConfig({
  envDir: false,
  plugins: [
    fumadocsMdx({
      index: { target: "vite" },
      macro: false,
      globalOptions: { mdxOptions: { rehypeCodeOptions: false, remarkStructureOptions: false } },
    }),
  ],
  resolve: { conditions: ["namera-source"], tsconfigPaths: true },
  ssr: {
    noExternal: [/^@namera-ai\//],
    resolve: {
      conditions: ["namera-source"],
      externalConditions: ["namera-source", "node"],
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    maxWorkers: 2,
    server: { deps: { inline: [/^@namera-ai\//] } },
  },
});
