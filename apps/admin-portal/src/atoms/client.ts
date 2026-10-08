import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { AtomHttpApi } from "effect/reactivity";

import { NameraApi } from "@namera-ai/api";

import { env } from "@/env";
import { adminRuntime } from "@/telemetry";

export class NameraClient extends AtomHttpApi.Service<NameraClient>()(
  "@namera-ai/admin-portal/NameraClient",
  {
    api: NameraApi,
    runtime: adminRuntime,
    baseUrl: env.backendUrl,
    httpClient: FetchHttpClient.layer.pipe(
      Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { credentials: "include" })),
    ),
  },
) {}
