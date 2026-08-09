import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";

import { NameraApi } from "@namera-ai/api";

import { env } from "@/env";

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
    baseUrl: env.backendUrl,
    httpClient: HttpClientLive,
  },
) {}
