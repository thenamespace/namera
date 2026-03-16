import { Config, ConfigProvider, Context, Effect, Layer } from "effect";

export const EnvConfig = Config.all({
  backendUrl: Config.url("VITE_BACKEND_URL"),
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
