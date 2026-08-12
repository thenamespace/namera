import { Effect, Option } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiSchema } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { setAuthCookie } from "#/helpers/index";
import { clientIdentifier, consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const MagicLinkRoutes = HttpApiBuilder.group(NameraApi, "magicLink", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers
      .handle("request", ({ payload }) =>
        Effect.gen(function* () {
          const identifier = yield* clientIdentifier;
          yield* consumeRateLimit(
            "magic-link.request.ip",
            identifier,
            rateLimitPolicy.magicLink.requestByIp,
          );
          yield* consumeRateLimit(
            "magic-link.request.email",
            payload.email,
            rateLimitPolicy.magicLink.requestByEmail,
          );

          const body = yield* app.magicLink.request(payload);

          return HttpApiSchema.withHeaders({
            body,
            headers: { "cache-control": "no-store" as const },
          });
        }),
      )
      .handle("verify", ({ payload }) =>
        Effect.gen(function* () {
          const identifier = yield* clientIdentifier;
          yield* consumeRateLimit(
            "magic-link.verify.ip",
            identifier,
            rateLimitPolicy.magicLink.verifyByIp,
          );

          const request = yield* HttpServerRequest.HttpServerRequest;
          const verified = yield* app.magicLink.verify(payload, {
            ipAddress: Option.getOrNull(request.remoteAddress),
            userAgent: request.headers["user-agent"] ?? null,
          });
          yield* setAuthCookie(verified.sessionToken);
          return HttpApiSchema.withHeaders({
            body: { returnTo: verified.returnTo },
            headers: { "cache-control": "no-store" as const },
          });
        }),
      );
  }),
);
