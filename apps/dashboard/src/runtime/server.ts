import { getCookie } from "@tanstack/react-start/server";

import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "@effect/platform";
import { OtelServerLive } from "@namera-ai/telemetry/frontend-ssr";
import { Effect, Layer, ManagedRuntime } from "effect";

import { ApiClientLive } from "@/layers/api";
import { ServerEnv, ServerEnvLive } from "@/layers/env/server";

const CustomFetchLive = FetchHttpClient.layer.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, {
      credentials: "include",
    }),
  ),
);

const ServerApiClient = Layer.unwrapEffect(
  Effect.gen(function* () {
    const env = yield* ServerEnv;
    return ApiClientLive(env.backendUrl.toString());
  }),
);

export const CustomHttpClientLive = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const baseClient = yield* HttpClient.HttpClient;

    return baseClient.pipe(
      HttpClient.mapRequest((request) => {
        let req = HttpClientRequest.setHeader(
          request,
          "credentials",
          "include",
        );

        const isServer = typeof window === "undefined";

        if (isServer) {
          const token = getCookie("auth-token");
          if (token) {
            req = HttpClientRequest.setHeader(
              req,
              "Cookie",
              `auth-token=${token}`,
            );
          }
        }

        return req;
      }),
    );
  }),
);

const Layers = ServerApiClient.pipe(
  Layer.provideMerge(CustomHttpClientLive),
  Layer.provideMerge(CustomFetchLive),
  Layer.provideMerge(OtelServerLive),
  Layer.provideMerge(ServerEnvLive),
);
export const serverRuntime = ManagedRuntime.make(Layers);
