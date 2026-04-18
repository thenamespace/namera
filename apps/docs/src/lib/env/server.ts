import { Config, ConfigProvider, Effect } from "effect";

const ServerEnv = Config.all({
  githubToken: Config.string("GITHUB_TOKEN").pipe(Config.withDefault("")),
  openRouterApiKey: Config.string("OPENROUTER_API_KEY").pipe(
    Config.withDefault(""),
  ),
  openRouterModel: Config.string("OPENROUTER_MODEL").pipe(
    Config.withDefault("openai/gpt-4o-mini"),
  ),
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
