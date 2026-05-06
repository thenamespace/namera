import { Config, ConfigProvider, Effect, Layer, Context } from "effect";

export const EnvConfig = Config.all({
  backendUrl: Config.url("VITE_BACKEND_URL"),
  baseUrl: Config.url("VITE_BASE_URL"),
  reownProjectId: Config.string("VITE_REOWN_PROJECT_ID"),
});

export type Env = Config.Success<typeof EnvConfig>;
export const Env = Context.Service<Env>("@namera-ai/dashboard/Env");

export const layer = Layer.effect(
  Env,
  Effect.gen(function* () {
    const env = yield* EnvConfig;
    return env;
  }).pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnv({
        env: import.meta.env,
      }),
    ),
  ),
);
