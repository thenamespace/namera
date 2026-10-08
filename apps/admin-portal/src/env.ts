import { Config, ConfigProvider, Effect } from "effect";

import { resolveApiUrl } from "@/api-url";

export const env = Effect.runSync(
  Config.all({
    environment: Config.String("MODE").pipe(Config.withDefault("development")),
    telemetryServiceVersion: Config.String("VITE_TELEMETRY_SERVICE_VERSION").pipe(
      Config.withDefault("development"),
    ),
    backendUrl: Config.String("VITE_API_URL").pipe(
      Config.withDefault(""),
      Config.map(resolveApiUrl),
    ),
  }).parse(ConfigProvider.fromUnknown(import.meta.env)),
);
