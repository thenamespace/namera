import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";

import { NameraApi } from "@namera-ai/api";

import { env } from "@/env";

export class NameraClient extends AtomHttpApi.Service<NameraClient>()(
  "@namera-ai/dashboard/NameraClient",
  {
    api: NameraApi,
    baseUrl: env.backendUrl,
    httpClient: FetchHttpClient.layer,
    transformClient: (client) =>
      HttpClient.transformResponse(client, (response) =>
        Effect.provideService(response, FetchHttpClient.RequestInit, {
          credentials: "include",
        }),
      ),
  },
) {}
