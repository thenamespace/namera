import { Effect } from "effect";

import { FetchHttpClient, HttpClient } from "effect/unstable/http";

import { annotateDashboardRoute } from "@/actions/telemetry";
import { env } from "@/env";

export const getIpLocation = Effect.fn("ipLocation.get")(function* (
  ipAddress: string | undefined,
) {
  yield* annotateDashboardRoute();
  const client = yield* HttpClient.HttpClient;

  if (!ipAddress) return null;

  const res = yield* client.get(
    `https://api.ipgeolocation.io/v3/ipgeo?apiKey=${env.ipGeoApiKey}&ip=${ipAddress}`,
  );

  if (res.status !== 200) {
    return null;
  }

  const data = (yield* res.json) as {
    location: {
      city: string;
      state_code: string;
      country_code2: string;
    };
  };

  if ("error" in data) {
    return null;
  }

  return {
    city: data.location.city,
    regionCode: data.location.state_code,
    country: data.location.country_code2,
  };
}, Effect.provide(FetchHttpClient.layer));
