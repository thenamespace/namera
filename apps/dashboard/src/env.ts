import { Config, ConfigProvider, Effect } from "effect";

const EnvConfig = Config.all({
  backendUrl: Config.string("VITE_API_URL"),
});

export const env = Effect.runSync(EnvConfig.parse(ConfigProvider.fromUnknown(import.meta.env)));
