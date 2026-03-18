import { HttpApiClient } from "@effect/platform";
import { api } from "@namera-ai/api";
import { Context, Effect, Layer } from "effect";

const makeApiClient = (baseUrl: string) =>
  Effect.gen(function* () {
    const client = HttpApiClient.make(api, {
      baseUrl: baseUrl,
    });

    return yield* client;
  });

type ApiClientShape = Effect.Effect.Success<ReturnType<typeof makeApiClient>>;

export class ApiClient extends Context.Tag("@namera/dashboard/ApiClient")<
  ApiClient,
  ApiClientShape
>() {}

export const ApiClientLive = (baseUrl: string) =>
  Layer.effect(ApiClient, makeApiClient(baseUrl));
