import { Effect, Layer, ServiceMap } from "effect";

import { HttpApiClient } from "effect/unstable/httpapi";

import { api } from "@namera-ai/api";

import { Env } from "./env";

const makeApiClient = Effect.gen(function* () {
  const env = yield* Env;
  const client = yield* HttpApiClient.make(api, {
    baseUrl: env.backendUrl,
  });

  return client;
});

type ApiClient = Effect.Success<typeof makeApiClient>;

export const ApiClient = ServiceMap.Service<ApiClient>(
  "@namera/dashboard/ApiClient",
);

export const layer = Layer.effect(ApiClient, makeApiClient);
