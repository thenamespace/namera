import { FetchHttpClient } from "@effect/platform";
import { Layer, ManagedRuntime } from "effect";

import { EnvClientLive } from "@/layers";

const CustomFetchLive = FetchHttpClient.layer.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, {
      credentials: "include",
    }),
  ),
);

const Layers = CustomFetchLive.pipe(Layer.provideMerge(EnvClientLive));
export const clientRuntime = ManagedRuntime.make(Layers);
