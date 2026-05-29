import type { UpdateUserRequest } from "@namera-ai/schema/dto";

import { Effect } from "effect";

import { Reactivity } from "effect/unstable/reactivity";

import { annotateDashboardRoute } from "@/actions/telemetry";
import { atomRuntime, atomKeys } from "@/lib/atom";
import { ApiClient } from "@/services";

export const getCurrentUser = Effect.fn("auth.currentUser")(
  function* () {
    yield* annotateDashboardRoute();
    const client = yield* ApiClient.ApiClient;
    return yield* client.auth.currentUser();
  },
  Effect.catchTag("Unauthorized", () => Effect.succeed(null)),
);

export const updateUserAtom = atomRuntime.fn<UpdateUserRequest>()(
  Effect.fn("auth.user.update")(function* (data) {
    yield* annotateDashboardRoute();
    const client = yield* ApiClient.ApiClient;
    const result = yield* client.user.update({ payload: data });
    yield* Reactivity.invalidate(atomKeys.auth.me);
    return result;
  }),
);
