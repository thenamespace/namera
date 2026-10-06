import { tanstackRouter } from "@tanstack/router-plugin/vite";

import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig, loadEnv } from "vite";

import { resolveApiUrl } from "./src/api-url.ts";
import { documentSecurity } from "./tooling/document-security.ts";

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const security = documentSecurity(resolveApiUrl(env.VITE_API_URL));
  const { "Content-Security-Policy": _csp, ...developmentHeaders } = security.headers;

  return {
    server: { headers: developmentHeaders },
    preview: { headers: security.headers },
    resolve: { conditions: ["namera-source", ...defaultClientConditions], tsconfigPaths: true },
    plugins: [
      security.plugin,
      tailwindcss(),
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      viteReact(),
    ],
  };
});

export default config;
