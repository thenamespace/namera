import { HttpApiClient } from "@effect/platform";
import { api } from "@namera-ai/api";
import { Context, Effect, Layer } from "effect";

import { Env } from "./env";

const makeApiClient = Effect.gen(function* () {
  const env = yield* Env;
  const client = HttpApiClient.make(api, {
    baseUrl: env.backendUrl,
  });

  return yield* client;
});

type ApiClientShape = Effect.Effect.Success<typeof makeApiClient>;

export class ApiClient extends Context.Tag("@namera/dashboard/ApiClient")<
  Env,
  ApiClientShape
>() {}

export const ApiClientLive = Layer.effect(ApiClient, makeApiClient);
