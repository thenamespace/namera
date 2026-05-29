import type { UpdateUserRequest } from "@namera-ai/schema/dto";

import { Effect } from "effect";

import { clientRuntime } from "@/lib/runtime";
import { ApiClient } from "@/services";

import { annotateDashboardRoute } from "../telemetry";

export const updateUser = async (data: UpdateUserRequest) =>
  clientRuntime.runPromise(
    Effect.fn("auth.user.update")(function* () {
      yield* annotateDashboardRoute();
      const client = yield* ApiClient.ApiClient;
      return yield* client.user.update({ payload: data });
    })(),
  );
