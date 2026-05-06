import { Config, Effect, Layer, Context } from "effect";

const ServerConfig = Config.all({
  alchemyApiKey: Config.redacted("ALCHEMY_API_KEY"),
});

type Env = Config.Success<typeof ServerConfig>;

export const Env = Context.Service<Env>("Env");

export const layer = Layer.effect(
  Env,
  Effect.gen(function* () {
    const config = yield* ServerConfig;
    return config;
  }),
);
