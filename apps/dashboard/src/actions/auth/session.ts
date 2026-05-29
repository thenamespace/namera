import { Effect } from "effect";

import { Reactivity } from "effect/unstable/reactivity";

import { annotateDashboardRoute } from "@/actions/telemetry";
import { atomKeys, atomRuntime } from "@/lib/atom";
import { ApiClient } from "@/services";

export const listSessions = Effect.fn("auth.listSessions")(function* () {
  yield* annotateDashboardRoute();
  const client = yield* ApiClient.ApiClient;
  return yield* client.auth.listSessions();
});

export const logout = atomRuntime.fn<void>()(
  Effect.fn("auth.logout")(function* () {
    yield* annotateDashboardRoute();
    const client = yield* ApiClient.ApiClient;
    yield* client.auth.logout();
    yield* Reactivity.invalidate(atomKeys.auth.me);
  }),
);
