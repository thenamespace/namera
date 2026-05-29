import { ConfigProvider, Layer, ManagedRuntime } from "effect";

import { FetchHttpClient } from "effect/unstable/http";

import { ApiClient, Env } from "@/services";
import { OtelWeb, OtelWebConfig } from "@namera-ai/telemetry/web";

const CustomFetchHttpClient = FetchHttpClient.layer.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, {
      credentials: "include",
    }),
  ),
);

const ViteConfigProvider = Layer.succeed(
  ConfigProvider.ConfigProvider,
  ConfigProvider.fromEnv({
    env: import.meta.env,
  }),
);

export const Layers = Layer.empty
  .pipe(
    Layer.provideMerge(ApiClient.layer),
    Layer.provide(CustomFetchHttpClient),
    Layer.provide(OtelWeb.layer("namera-dashboard")),
    Layer.provide(OtelWebConfig.layer),
    Layer.provideMerge(Env.layer),
  )
  .pipe(Layer.provide(ViteConfigProvider));

export const clientRuntime = ManagedRuntime.make(Layers);
