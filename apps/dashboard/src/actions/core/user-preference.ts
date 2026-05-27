import type { UpdateUserPreferenceRequest } from "@namera-ai/schema";

import { Effect } from "effect";

import { clientRuntime } from "@/lib/runtime";
import { ApiClient } from "@/services";

export const updateUserPreferences = async (
  data: UpdateUserPreferenceRequest,
) =>
  clientRuntime.runPromise(
    Effect.gen(function* () {
      const client = yield* ApiClient.ApiClient;
      return yield* client.userPreferences.update({
        payload: data,
      });
    }),
  );

export const getUserPreferences = async () =>
  clientRuntime.runPromise(
    Effect.gen(function* () {
      const client = yield* ApiClient.ApiClient;
      return yield* client.userPreferences.get();
    }),
  );
