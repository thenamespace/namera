import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";

export const BetaInviteRoutes = HttpApiBuilder.group(NameraApi, "betaInvite", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application;
    return handlers
      .handle("create", ({ payload }) => app.betaInvite.create(payload))
      .handle("revoke", ({ params }) => app.betaInvite.revoke(params.id));
  }),
);
