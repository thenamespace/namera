import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { AuthTokenSecurity, NameraApi } from "@namera-ai/api";
import { authPolicy, MagicLinkService } from "@namera-ai/application";

export const MagicLinkRoutes = HttpApiBuilder.group(NameraApi, "magicLink", (handlers) =>
  Effect.gen(function* () {
    const magicLink = yield* MagicLinkService;

    return handlers
      .handle("request", ({ payload }) => magicLink.request(payload))
      .handle("verify", ({ payload }) =>
        Effect.gen(function* () {
          const verified = yield* magicLink.verify(payload);
          yield* HttpApiBuilder.securitySetCookie(AuthTokenSecurity, verified.sessionToken, {
            path: authPolicy.cookie.path,
            httpOnly: authPolicy.cookie.httpOnly,
            secure: authPolicy.cookie.secure,
            sameSite: authPolicy.cookie.sameSite,
            maxAge: authPolicy.session.timeToLive,
          });
          return { returnTo: verified.returnTo };
        }),
      );
  }),
);
