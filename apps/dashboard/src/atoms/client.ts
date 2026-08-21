import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";

import { NameraApi } from "@namera-ai/api";

import { env } from "@/env";
import { dashboardRuntime } from "@/telemetry";

// One generated AtomHttpApi client backs loaders and hooks, so both paths share
// the router-owned atom cache. Cookie credentials are installed once here
// instead of being repeated by every query and mutation.
export class NameraClient extends AtomHttpApi.Service<NameraClient>()(
  "@namera-ai/dashboard/NameraClient",
  {
    api: NameraApi,
    baseUrl: env.backendUrl,
    httpClient: FetchHttpClient.layer,
    runtime: dashboardRuntime,
    transformClient: (client) =>
      HttpClient.transformResponse(client, (response) => {
        const request = Effect.provideService(response, FetchHttpClient.RequestInit, {
          credentials: "include",
        });

        // Keep local loading transitions observable without changing production latency.
        return env.environment === "development" ? Effect.delay(request, "300 millis") : request;
      }),
  },
) {}
