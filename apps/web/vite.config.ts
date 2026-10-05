import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defaultClientConditions, defineConfig } from "vite";

export default defineConfig({
  resolve: {
    conditions: ["namera-source", ...defaultClientConditions],
    /*
     * The app's React comes from the workspace source condition, while a
     * pre-bundled dependency resolves its own peer copy out of .vite/deps.
     * Two Reacts means every hook a dependency calls throws "Invalid hook
     * call", which is what @paper-design/shaders-react hit. Pin both to one.
     */
    dedupe: ["react", "react-dom"],
    tsconfigPaths: true,
  },
  plugins: [
    fumadocsMdx({
      index: { target: "vite" },
      macro: false,
      // Keep the existing legal renderer and use processed Markdown for blog search.
      globalOptions: { mdxOptions: { rehypeCodeOptions: false, remarkStructureOptions: false } },
    }),
    tailwindcss(),
    tanstackStart(),
    // Keep Shiki's JS WASM loader; native unwasm exports conflict with Vite 8.
    nitro({
      wasm: false,
      // Nitro owns server resolution separately from Vite's client conditions.
      exportConditions: ["namera-source"],
    }),
    viteReact(),
  ],
});
