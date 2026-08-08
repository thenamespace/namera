import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { setAuthCookie } from "#/helpers/index";

export const MagicLinkRoutes = HttpApiBuilder.group(NameraApi, "magicLink", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers
      .handle("request", ({ payload }) => app.magicLink.request(payload))
      .handle("verify", ({ payload }) =>
        Effect.gen(function* () {
          const verified = yield* app.magicLink.verify(payload);
          yield* setAuthCookie(verified.sessionToken);
          return { returnTo: verified.returnTo };
        }),
      );
  }),
);
