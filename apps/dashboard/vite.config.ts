import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const config = defineConfig({
  plugins: [
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackRouter({
      target: "react",
      generatedRouteTree: "src/route-tree.gen.ts",
      quoteStyle: "double",
      routeFileIgnorePrefix: "-",
      routesDirectory: "src/app",
      routeTreeFileHeader: [
        "/** biome-ignore-all lint/style/useNamingConvention: safe */",
        "/** biome-ignore-all lint/suspicious/noExplicitAny: safe  */",
        "// @ts-nocheck",
      ],
      semicolons: true,
    }),
    viteReact(),
  ],
  server: { port: 3000 },
});

export default config;
