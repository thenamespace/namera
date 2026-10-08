import { Effect } from "effect";
import { Atom } from "effect/reactivity";

import { NameraClient } from "@/atoms/client";

export const currentAdminAtom = NameraClient.runtime
  .atom(
    Effect.gen(function* () {
      const client = yield* NameraClient;
      return yield* client.platform.me({}).pipe(
        Effect.map((admin) => ({ status: "authorized" as const, admin })),
        Effect.catchTag("Unauthorized", () => Effect.succeed({ status: "signed-out" as const })),
        Effect.catchTag("Forbidden", () => Effect.succeed({ status: "denied" as const })),
      );
    }),
  )
  .pipe(Atom.setIdleTTL("0 seconds"));

export const googleConfigurationAtom = NameraClient.query("google", "configuration", {});
export const startGoogleMutation = NameraClient.mutation("google", "start");
export const requestMagicLinkMutation = NameraClient.mutation("magicLink", "request");
export const verifyMagicLinkMutation = NameraClient.mutation("magicLink", "verify");
export const logoutMutation = NameraClient.mutation("platformSession", "logout");
