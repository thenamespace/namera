import { Config, ConfigProvider, Effect } from "effect";

const Env = Config.all({
  baseUrl: Config.url("VITE_BASE_URL").pipe(
    Config.withDefault(new URL("https://namera.ai")),
  ),
  postHogAssetsHost: Config.string("VITE_PUBLIC_POSTHOG_ASSETS_HOST").pipe(
    Config.withDefault(""),
  ),
  postHogHost: Config.string("VITE_PUBLIC_POSTHOG_HOST").pipe(
    Config.withDefault(""),
  ),
  postHogToken: Config.string("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN").pipe(
    Config.withDefault(""),
  ),
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
