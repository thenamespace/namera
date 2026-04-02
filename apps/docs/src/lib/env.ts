import { Config, ConfigProvider, Effect } from "effect";

const Env = Config.all({
  baseUrl: Config.url("VITE_BASE_URL"),
  postHogAssetsHost: Config.string("VITE_PUBLIC_POSTHOG_ASSETS_HOST"),
  postHogHost: Config.string("VITE_PUBLIC_POSTHOG_HOST"),
  postHogToken: Config.string("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN"),
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
