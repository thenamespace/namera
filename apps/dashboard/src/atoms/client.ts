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
      HttpClient.transform(client, (response, httpRequest) => {
        const request = Effect.provideService(response, FetchHttpClient.RequestInit, {
          credentials: "include",
        });

        // Authentication owns whether the protected shell may render, so the development
        // delay only applies to page data that can expose a local loading state.
        const isSessionBootstrap = httpRequest.url.endsWith("/auth/session/me");

        return env.environment === "development" && !isSessionBootstrap
          ? Effect.delay(request, "300 millis")
          : request;
      }),
  },
) {}
