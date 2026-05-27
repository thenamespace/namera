import type { UpdateUserRequest } from "@namera-ai/schema";

import { Effect } from "effect";

import { clientRuntime } from "@/lib/runtime";
import { ApiClient } from "@/services";

export const updateUser = async (data: UpdateUserRequest) =>
  clientRuntime.runPromise(
    Effect.gen(function* () {
      const client = yield* ApiClient.ApiClient;
      return yield* client.user.update({ payload: data });
    }),
  );
