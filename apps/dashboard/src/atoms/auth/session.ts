import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const currentUserAtom = NameraClient.runtime
  .atom(
    Effect.gen(function* () {
      const client = yield* NameraClient;
      return yield* client.session
        .currentUser({})
        .pipe(Effect.catchCause(() => Effect.succeed(null)));
    }),
  )
  .pipe(
    NameraClient.runtime.factory.withReactivity(QueryKeys.session.current),
    Atom.setIdleTTL("30 seconds"),
  );

export const sessionsAtom = NameraClient.query("session", "listSessions", {
  reactivityKeys: QueryKeys.session.lists,
  timeToLive: "30 seconds",
});

export const logoutMutation = NameraClient.mutation("session", "logout");

export const revokeOtherSessionsMutation = NameraClient.mutation("session", "revokeOtherSessions");
