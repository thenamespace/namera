import { Config, ConfigProvider, Effect } from "effect";

const ServerEnv = Config.all({
  openRouterApiKey: Config.string("OPENROUTER_API_KEY"),
  openRouterModel: Config.string("OPENROUTER_MODEL"),
});

export const serverEnv = Effect.runSync(
  Effect.gen(function* () {
    const env = yield* ServerEnv;
    return env;
  }).pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnv({
        env: process.env as Record<string, string>,
      }),
    ),
  ),
);
