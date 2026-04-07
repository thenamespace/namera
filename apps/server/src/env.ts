import { Config, Effect, Layer, ServiceMap } from "effect";

const ServerConfig = Config.all({
  alchemyApiKey: Config.redacted("ALCHEMY_API_KEY"),
});

type Env = Config.Success<typeof ServerConfig>;

export const Env = ServiceMap.Service<Env>("Env");

export const layer = Layer.effect(
  Env,
  Effect.gen(function* () {
    const config = yield* ServerConfig;
    return config;
  }),
);
