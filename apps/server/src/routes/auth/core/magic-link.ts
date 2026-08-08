import { Effect } from "effect";
import { HttpApiBuilder, HttpApiSchema } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { setAuthCookie } from "#/helpers/index";

export const MagicLinkRoutes = HttpApiBuilder.group(NameraApi, "magicLink", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers
      .handle("request", ({ payload }) =>
        Effect.map(app.magicLink.request(payload), (body) =>
          HttpApiSchema.withHeaders({
            body,
            headers: { "cache-control": "no-store" as const },
          }),
        ),
      )
      .handle("verify", ({ payload }) =>
        Effect.gen(function* () {
          const verified = yield* app.magicLink.verify(payload);
          yield* setAuthCookie(verified.sessionToken);
          return HttpApiSchema.withHeaders({
            body: { returnTo: verified.returnTo },
            headers: { "cache-control": "no-store" as const },
          });
        }),
      );
  }),
);
