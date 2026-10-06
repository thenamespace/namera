import { Config, ConfigProvider, Effect } from "effect";

import { resolveApiUrl } from "./api-url";

const EnvConfig = Config.all({
  backendUrl: Config.String("VITE_API_URL").pipe(Config.withDefault(""), Config.map(resolveApiUrl)),
  environment: Config.String("MODE").pipe(Config.withDefault("development")),
});

export const env = Effect.runSync(EnvConfig.parse(ConfigProvider.fromUnknown(import.meta.env)));
