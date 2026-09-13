import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defaultClientConditions, defineConfig } from "vite";

export default defineConfig({
  resolve: {
    conditions: ["namera-source", ...defaultClientConditions],
    tsconfigPaths: true,
  },
  plugins: [fumadocsMdx(), tailwindcss(), tanstackStart(), viteReact()],
});
