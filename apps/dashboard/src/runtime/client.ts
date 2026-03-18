import { FetchHttpClient } from "@effect/platform";
import { OtelWebLive } from "@namera-ai/telemetry/frontend";
import { Effect, Layer, ManagedRuntime } from "effect";

import { ApiClientLive } from "@/layers/api";
import { ClientEnv, ClientEnvLive } from "@/layers/env/client";

const CustomFetchLive = FetchHttpClient.layer.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, {
      credentials: "include",
    }),
  ),
);

const ClientApiClient = Layer.unwrapEffect(
  Effect.gen(function* () {
    const env = yield* ClientEnv;
    return ApiClientLive(env.backendUrl.toString());
  }),
);

const Layers = ClientApiClient.pipe(
  Layer.provideMerge(CustomFetchLive),
  Layer.provide(OtelWebLive),
  Layer.provideMerge(ClientEnvLive),
);
export const clientRuntime = ManagedRuntime.make(Layers);
