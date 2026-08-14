export const telemetryData = {
  serviceNames: {
    dashboard: "namera-dashboard",
    server: "namera-server",
  },
  exportInterval: "10 seconds",
  logExportInterval: "1 second",
  proxyBodyLimit: 2 * 1024 * 1024,
  proxyTimeout: "10 seconds",
  shutdownTimeout: "3 seconds",
} as const;
