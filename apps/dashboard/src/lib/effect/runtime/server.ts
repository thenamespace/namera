import { FetchHttpClient } from "@effect/platform";
import { Layer, ManagedRuntime } from "effect";

import { ApiClientLive, EnvLive, OtelWebLive } from "@/layers";

const CustomFetchLive = FetchHttpClient.layer.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, {
      credentials: "include",
    }),
  ),
);

const Layers = ApiClientLive.pipe(
  Layer.provideMerge(EnvLive),
  Layer.provideMerge(CustomFetchLive),
  Layer.provideMerge(OtelWebLive),
);
export const serverRuntime = ManagedRuntime.make(Layers);
