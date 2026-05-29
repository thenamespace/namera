import type { UpdateUserPreferencesRequest } from "@namera-ai/schema/dto";

import { Effect } from "effect";

import { Reactivity } from "effect/unstable/reactivity";

import { atomKeys, atomRuntime } from "@/lib/atom";
import { ApiClient } from "@/services";

import { annotateDashboardRoute } from "../telemetry";

export const updateUserPreferences =
  atomRuntime.fn<UpdateUserPreferencesRequest>()(
    Effect.fn("userPreferences.update")(function* (data) {
      yield* annotateDashboardRoute();
      const client = yield* ApiClient.ApiClient;
      const res = yield* client.userPreferences.update({
        payload: data,
      });

      yield* Reactivity.invalidate(atomKeys.userPreference.get);

      return res;
    }),
  );

export const getUserPreferences = Effect.fn("userPreferences.get")(
  function* () {
    yield* annotateDashboardRoute();
    const client = yield* ApiClient.ApiClient;
    return yield* client.userPreferences.get();
  },
);
