import { Config, ConfigProvider, Effect } from "effect";

import { resolveApiUrl } from "@/api-url";

export const env = Effect.runSync(
  Config.all({
    backendUrl: Config.String("VITE_API_URL").pipe(
      Config.withDefault(""),
      Config.map(resolveApiUrl),
    ),
  }).parse(ConfigProvider.fromUnknown(import.meta.env)),
);
