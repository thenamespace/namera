import { ConfigProvider, Effect } from "effect";

import { EnvConfig } from "./services/env";

export const env = Effect.runSync(
  Effect.gen(function* () {
    return yield* EnvConfig;
  }).pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnv({
        env: import.meta.env,
      }),
    ),
  ),
);
