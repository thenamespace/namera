import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

import posthog from "@posthog/rollup-plugin";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig, loadEnv } from "vite";

import { documentSecurity } from "./tooling/document-security.ts";
import { documentSeo } from "./tooling/document-seo.ts";

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const posthogProjectId = process.env.POSTHOG_CLI_PROJECT_ID ?? "";
  const posthogRelease = process.env.POSTHOG_RELEASE_VERSION ?? "";
  if (process.env.POSTHOG_CLI_API_KEY && (!posthogProjectId || !posthogRelease)) {
    throw new Error("PostHog source-map uploads require a project ID and release version");
  }
  const security = documentSecurity(env.VITE_API_URL ?? "");
  const { "Content-Security-Policy": _csp, ...developmentHeaders } = security.headers;

  return {
    server: { headers: developmentHeaders },
    preview: { headers: security.headers },
    resolve: { conditions: ["namera-source", ...defaultClientConditions], tsconfigPaths: true },
    plugins: [
      security.plugin,
      documentSeo(),
      devtools(),
      tailwindcss(),
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      viteReact(),
      ...(process.env.POSTHOG_CLI_API_KEY
        ? [
            posthog({
              personalApiKey: process.env.POSTHOG_CLI_API_KEY,
              projectId: posthogProjectId,
              host: "https://eu.posthog.com",
              sourcemaps: {
                enabled: true,
                releaseName: "namera-dashboard",
                releaseVersion: posthogRelease,
                deleteAfterUpload: true,
              },
            }),
          ]
        : []),
    ],
  };
});

export default config;
