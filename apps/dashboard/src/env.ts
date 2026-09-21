import { Config, ConfigProvider, Effect } from "effect";

const EnvConfig = Config.all({
  backendUrl: Config.String("VITE_API_URL"),
  environment: Config.String("MODE").pipe(Config.withDefault("development")),
  telemetryServiceVersion: Config.String("VITE_TELEMETRY_SERVICE_VERSION").pipe(
    Config.withDefault("development"),
  ),
});

export const env = Effect.runSync(EnvConfig.parse(ConfigProvider.fromUnknown(import.meta.env)));
