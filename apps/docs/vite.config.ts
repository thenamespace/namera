import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const takumiDeps = [
  "@takumi-rs/image-response",
  "@takumi-rs/core",
  "@takumi-rs/core-darwin-arm64",
  "@takumi-rs/core-linux-x64-gnu",
];

const config = defineConfig({
  optimizeDeps: {
    exclude: takumiDeps,
  },
  plugins: [
    mdx(await import("./source.config")),
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
    nitro({
      traceDeps: takumiDeps,
    }),
    viteReact(),
  ],
  server: { port: 4000 },
  ssr: {
    external: takumiDeps,
  },
});

export default config;
