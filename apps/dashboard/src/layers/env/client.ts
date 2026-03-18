import { Config, ConfigProvider, Context, Effect, Layer } from "effect";

const ClientEnvConfig = Config.all({
  backendUrl: Config.url("VITE_BACKEND_URL"),
  reownProjectId: Config.string("VITE_REOWN_PROJECT_ID"),
});

export type ClientEnvShape = Config.Config.Success<typeof ClientEnvConfig>;

export class ClientEnv extends Context.Tag("@namera/dashboard/ClientEnv")<
  ClientEnv,
  ClientEnvShape
>() {}

export const ClientEnvLive = Layer.effect(
  ClientEnv,
  Effect.gen(function* () {
    const config = yield* ClientEnvConfig;
    return ClientEnv.of(config);
  }),
).pipe(
  Layer.provide(
    Layer.setConfigProvider(ConfigProvider.fromJson(import.meta.env)),
  ),
);
