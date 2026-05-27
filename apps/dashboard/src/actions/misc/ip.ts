import { Effect } from "effect";

import { FetchHttpClient, HttpClient } from "effect/unstable/http";

import { env } from "@/env";
import { clientRuntime } from "@/lib/runtime";

export const getIpLocation = (ipAddress?: string) =>
  clientRuntime.runPromise(
    Effect.gen(function* () {
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
    }).pipe(Effect.provide(FetchHttpClient.layer)),
  );
