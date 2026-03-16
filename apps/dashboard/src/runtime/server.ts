import { getCookie } from "@tanstack/react-start/server";

import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "@effect/platform";
import { Effect, Layer, ManagedRuntime } from "effect";

import { ApiClientLive, EnvLive } from "@/layers";

const CustomFetchLive = FetchHttpClient.layer.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, {
      credentials: "include",
    }),
  ),
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
          console.log("Sending from server...");
          const token = getCookie("auth-token");
          if (token) {
            req = HttpClientRequest.setHeader(
              req,
              "Cookie",
              `auth-token=${token}`,
            );
          }
        } else {
          console.log("Sending request from client...");
        }

        return req;
      }),
    );
  }),
);

const Layers = ApiClientLive.pipe(
  Layer.provideMerge(EnvLive),
  Layer.provideMerge(CustomHttpClientLive),
  Layer.provideMerge(CustomFetchLive),
  // Layer.provideMerge(OtelWebLive), // TODO: Add in future
);
export const serverRuntime = ManagedRuntime.make(Layers);
