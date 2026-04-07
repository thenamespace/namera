import { Layer, ManagedRuntime } from "effect";

import { FetchHttpClient } from "effect/unstable/http";

import { ApiClient, Env } from "@/services";

const CustomFetchHttpClient = FetchHttpClient.layer.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, {
      credentials: "include",
    }),
  ),
);

export const Layers = Layer.empty.pipe(
  Layer.provideMerge(ApiClient.layer),
  Layer.provide(CustomFetchHttpClient),
  Layer.provideMerge(Env.layer),
);

export const clientRuntime = ManagedRuntime.make(Layers);
