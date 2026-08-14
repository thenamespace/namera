import { Config, ConfigProvider, Effect } from "effect";

const EnvConfig = Config.all({
  backendUrl: Config.string("VITE_API_URL"),
  environment: Config.string("MODE").pipe(Config.withDefault("development")),
  telemetryServiceVersion: Config.string("VITE_TELEMETRY_SERVICE_VERSION").pipe(
    Config.withDefault("development"),
  ),
});

export const env = Effect.runSync(EnvConfig.parse(ConfigProvider.fromUnknown(import.meta.env)));
