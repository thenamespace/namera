import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: false,
  plugins: [react(), tailwindcss()],
  resolve: { conditions: ["namera-source"], tsconfigPaths: true },
  optimizeDeps: { include: ["@hookform/resolvers/standard-schema"] },
  test: {
    include: ["tests/browser/**/*.test.tsx"],
    setupFiles: ["./tests/browser/setup.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
