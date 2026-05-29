import { Config, Effect, Layer, Context } from "effect";

export const EnvConfig = Config.all({
  backendUrl: Config.url("VITE_BACKEND_URL"),
  baseUrl: Config.url("VITE_BASE_URL"),
  reownProjectId: Config.string("VITE_REOWN_PROJECT_ID"),
  ipGeoApiKey: Config.string("VITE_IP_GEO_API_KEY"),
});

export type Env = Config.Success<typeof EnvConfig>;
export const Env = Context.Service<Env>("@namera-ai/dashboard/Env");

export const layer = Layer.effect(
  Env,
  Effect.gen(function* () {
    const env = yield* EnvConfig;
    console.log(import.meta.env);
    return env;
  }),
);
