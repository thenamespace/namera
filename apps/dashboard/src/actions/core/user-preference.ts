import type { UpdateUserPreferencesRequest } from "@namera-ai/schema/dto";

import { Effect } from "effect";

import { clientRuntime } from "@/lib/runtime";
import { ApiClient } from "@/services";

import { annotateDashboardRoute } from "../telemetry";

export const updateUserPreferences = async (
  data: UpdateUserPreferencesRequest,
) =>
  clientRuntime.runPromise(
    Effect.fn("userPreferences.update")(function* () {
      yield* annotateDashboardRoute();
      const client = yield* ApiClient.ApiClient;
      return yield* client.userPreferences.update({
        payload: data,
      });
    })(),
  );

export const getUserPreferences = async () =>
  clientRuntime.runPromise(
    Effect.fn("userPreferences.get")(function* () {
      yield* annotateDashboardRoute();
      const client = yield* ApiClient.ApiClient;
      return yield* client.userPreferences.get();
    })(),
  );
