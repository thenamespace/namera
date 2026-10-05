import { Effect, Option, Schema } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiBuilder, HttpApiSchema } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";
import { InvalidMagicLinkError, VerificationId } from "@namera-ai/protocol";
import { MagicLinkToken } from "@namera-ai/protocol/dto";

import { betaSignupCookieName, setBetaSignupCookie } from "#/helpers/auth-cookie";
import { AuthCookieConfig, setAuthCookie } from "#/helpers/index";
import { clientIdentifier, consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const MagicLinkRoutes = HttpApiBuilder.group(NameraApi, "magicLink", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    const cookieConfig = yield* AuthCookieConfig;

    return handlers
      .handle("redeemInvite", ({ payload }) =>
        Effect.gen(function* () {
          yield* consumeRateLimit(
            "beta-invite.redeem.ip",
            yield* clientIdentifier,
            rateLimitPolicy.magicLink.verifyByIp,
          );
          yield* consumeRateLimit(
            "beta-invite.redeem.global",
            "signup",
            rateLimitPolicy.magicLink.inviteAttemptsGlobal,
          );
          const request = yield* HttpServerRequest.HttpServerRequest;
          const parts = (request.cookies[betaSignupCookieName] ?? "").split(".");
          const credential = yield* Schema.decodeUnknownEffect(
            Schema.Tuple([VerificationId, MagicLinkToken]),
          )(parts).pipe(
            Effect.mapError(() => new InvalidMagicLinkError({ code: "INVALID_OR_EXPIRED_LINK" })),
          );
          const verified = yield* app.magicLink.verify(
            {
              type: "invite",
              id: credential[0],
              token: credential[1],
              inviteCode: payload.inviteCode,
            },
            {
              ipAddress: Option.getOrNull(request.remoteAddress),
              userAgent: request.headers["user-agent"] ?? null,
            },
          );
          if (verified.sessionToken)
            yield* setAuthCookie(verified.sessionToken, cookieConfig.secure);
          yield* setBetaSignupCookie("", cookieConfig.secure);
          return HttpApiSchema.withHeaders({
            body: { returnTo: verified.returnTo },
            headers: { "cache-control": "no-store" as const },
          });
        }),
      )
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

          if (payload.inviteCode !== undefined) {
            yield* consumeRateLimit(
              "beta-invite.request.global",
              "signup",
              rateLimitPolicy.magicLink.inviteAttemptsGlobal,
            );
          }
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
          if (verified.sessionToken) {
            yield* setAuthCookie(verified.sessionToken, cookieConfig.secure);
            yield* setBetaSignupCookie("", cookieConfig.secure);
          } else if (verified.admissionToken) {
            yield* setBetaSignupCookie(verified.admissionToken, cookieConfig.secure);
          }
          return HttpApiSchema.withHeaders({
            body: { returnTo: verified.returnTo },
            headers: { "cache-control": "no-store" as const },
          });
        }),
      );
  }),
);
