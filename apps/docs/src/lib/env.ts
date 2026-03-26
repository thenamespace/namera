import { Config, ConfigProvider, Effect } from "effect";

const Env = Config.all({
  baseUrl: Config.url("VITE_BASE_URL"),
});

export const env = Effect.runSync(
  Effect.gen(function* () {
    const env = yield* Env;
    return env;
  }).pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnv({
        env: import.meta.env as Record<string, string>,
      }),
    ),
  ),
);
