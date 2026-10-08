import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
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
    httpClient: FetchHttpClient.layer,
    // Apply credentials at request time: telemetry shares the memoized fetch layer.
    transformClient: (client) =>
      HttpClient.transform(client, (response) =>
        Effect.provideService(response, FetchHttpClient.RequestInit, {
          credentials: "include",
        }),
      ),
  },
) {}
