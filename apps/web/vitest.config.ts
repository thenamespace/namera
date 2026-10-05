import { fumadocsMdx } from "fumadocs-mdx/vite";
import defineConfig from "klarity/vitest/node";

export default defineConfig({
  plugins: [
    fumadocsMdx({
      index: { target: "vite" },
      macro: false,
      globalOptions: { mdxOptions: { rehypeCodeOptions: false, remarkStructureOptions: false } },
    }),
  ],
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
