import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import posthog from "@posthog/rollup-plugin";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defaultClientConditions, defineConfig } from "vite";

const posthogProjectId = process.env.POSTHOG_CLI_PROJECT_ID ?? "";
const posthogRelease = process.env.POSTHOG_RELEASE_VERSION ?? "";
if (process.env.POSTHOG_CLI_API_KEY && (!posthogProjectId || !posthogRelease)) {
  throw new Error("PostHog source-map uploads require a project ID and release version");
}

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
      // Use Takumi's native Node backend and retain package-relative runtime assets.
      exportConditions: ["namera-source", "!unwasm"],
      rolldownConfig: { external: ["takumi-js/response"] },
      traceDeps: ["takumi-js"],
    }),
    viteReact(),
    ...(process.env.POSTHOG_CLI_API_KEY
      ? [
          posthog({
            personalApiKey: process.env.POSTHOG_CLI_API_KEY,
            projectId: posthogProjectId,
            host: "https://eu.posthog.com",
            sourcemaps: {
              enabled: true,
              releaseName: "namera-web",
              releaseVersion: posthogRelease,
              deleteAfterUpload: true,
            },
          }),
        ]
      : []),
  ],
});
