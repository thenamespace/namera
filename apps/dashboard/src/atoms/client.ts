import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";

import { NameraApi } from "@namera-ai/api";

const HttpClientLive = Layer.merge(
  FetchHttpClient.layer,
  Layer.succeed(FetchHttpClient.RequestInit, {
    credentials: "include",
  }),
);

export class NameraClient extends AtomHttpApi.Service<NameraClient>()(
  "@namera-ai/dashboard/NameraClient",
  {
    api: NameraApi,
    baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8080",
    httpClient: HttpClientLive,
  },
) {}
