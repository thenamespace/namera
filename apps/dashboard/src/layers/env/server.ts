import { Config, ConfigProvider, Context, Effect, Layer } from "effect";

export const ServerEnvConfig = Config.all({
  backendUrl: Config.url("BACKEND_URL"),
  baseUrl: Config.url("BASE_URL"),
  otelUrl: Config.url("OTEL_BASE_URL"),
});

export type ServerEnvShape = Config.Config.Success<typeof ServerEnvConfig>;

export class ServerEnv extends Context.Tag("@namera/dashboard/ServerEnv")<
  ServerEnv,
  ServerEnvShape
>() {}

export const ServerEnvLive = Layer.effect(
  ServerEnv,
  Effect.gen(function* () {
    const config = yield* ServerEnvConfig;
    return ServerEnv.of(config);
  }),
).pipe(
  Layer.provide(Layer.setConfigProvider(ConfigProvider.fromJson(process.env))),
);
