import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const config = defineConfig({
  plugins: [
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      router: {
        generatedRouteTree: "route-tree.gen.ts",
        quoteStyle: "double",
        routeFileIgnorePrefix: "-",
        routesDirectory: "app",
        routeTreeFileHeader: [
          "/** biome-ignore-all lint/style/useNamingConvention: safe */",
          "/** biome-ignore-all lint/suspicious/noExplicitAny: safe  */",
          "// @ts-nocheck",
        ],
        semicolons: true,
      },
    }),

    viteReact(),
  ],
  server: { port: 3000 },
});

export default config;
