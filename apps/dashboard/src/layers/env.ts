import { Config, ConfigProvider, Context, Effect, Layer } from "effect";

export const EnvConfig = Config.all({
  backendUrl: Config.url("VITE_BACKEND_URL"),
  baseUrl: Config.url("VITE_BASE_URL"),
  otelUrl: Config.url("VITE_OTEL_BASE_URL"),
});

export type EnvShape = Config.Config.Success<typeof EnvConfig>;

export class Env extends Context.Tag("@namera/dashboard/Env")<
  Env,
  EnvShape
>() {}

export const EnvLive = Layer.effect(
  Env,
  Effect.gen(function* () {
    const config = yield* EnvConfig;
    return Env.of(config);
  }),
).pipe(
  Layer.provide(
    Layer.setConfigProvider(ConfigProvider.fromJson(import.meta.env)),
  ),
);

export const EnvClientConfig = Config.all({
  backendUrl: Config.url("VITE_BACKEND_URL"),
  reownProjectId: Config.string("VITE_REOWN_PROJECT_ID"),
});

export type EnvClientShape = Config.Config.Success<typeof EnvClientConfig>;

export class EnvClient extends Context.Tag("@namera/dashboard/EnvClient")<
  EnvClient,
  EnvClientShape
>() {}

export const EnvClientLive = Layer.effect(
  EnvClient,
  Effect.gen(function* () {
    const config = yield* EnvClientConfig;
    return EnvClient.of(config);
  }),
).pipe(
  Layer.provide(
    Layer.setConfigProvider(ConfigProvider.fromJson(import.meta.env)),
  ),
);
