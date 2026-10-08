import { DateTime, Effect, Layer, Option, Redacted } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiError } from "effect/http-api";
import { RateLimiter } from "effect/persistence";

import {
  AdminAuthorization,
  CurrentAdmin,
  CurrentPlatformSession,
  PlatformSessionAuthorization,
} from "@namera-ai/api";
import { AuthConfig } from "@namera-ai/application";
import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import { platformPermissions, type PlatformPermission } from "@namera-ai/protocol/model";

import { clientIdentifier, consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

const makeAuthenticate = Effect.gen(function* () {
  const repository = yield* Repository;
  const crypto = yield* CryptoService;
  const config = yield* AuthConfig;
  const limiter = yield* RateLimiter.RateLimiter;
  return Effect.fn("server.admin.authenticate")(
    function* (credential: Redacted.Redacted<string>) {
      yield* consumeRateLimit(
        "admin.session.ip",
        yield* clientIdentifier,
        rateLimitPolicy.admin.sessionByIp,
      );
      const request = yield* HttpServerRequest.HttpServerRequest;
      const hash = yield* crypto.hash({
        purpose: cryptoPurpose.sessionToken,
        value: Redacted.value(credential),
      });
      const session = yield* repository.auth.session
        .findActiveByTokenHash(hash, yield* DateTime.now)
        .pipe(Effect.orDie);
      if (!session) return yield* new HttpApiError.Unauthorized();
      const user = yield* repository.auth.user.findById(session.userId).pipe(Effect.orDie);
      if (!user?.emailVerified) return yield* new HttpApiError.Unauthorized();
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        const allowed = [
          config.dashboardPublicOrigin.origin,
          ...Option.toArray(config.adminPublicOrigin).map((url) => url.origin),
        ];
        if (!request.headers.origin || !allowed.includes(request.headers.origin))
          return yield* new HttpApiError.Forbidden();
      }
      return { userId: user.id, sessionId: session.id };
    },
    Effect.provideService(RateLimiter.RateLimiter, limiter),
  );
});

export const AdminAuthorizationLive = Layer.effect(
  AdminAuthorization,
  Effect.gen(function* () {
    const authenticate = yield* makeAuthenticate;
    const repository = yield* Repository;
    return AdminAuthorization.of({
      authToken: Effect.fn("server.admin.authorize")(function* (httpEffect, { credential }) {
        const context = yield* authenticate(credential);
        const member = yield* repository.auth.platform
          .findMember(context.userId)
          .pipe(Effect.orDie);
        if (!member || member.status !== "active") return yield* new HttpApiError.Forbidden();
        return yield* Effect.provideService(httpEffect, CurrentAdmin, { ...context, member });
      }),
    });
  }),
);

export const PlatformSessionAuthorizationLive = Layer.effect(
  PlatformSessionAuthorization,
  Effect.gen(function* () {
    const authenticate = yield* makeAuthenticate;
    return PlatformSessionAuthorization.of({
      authToken: Effect.fn("server.admin.invitee")(function* (httpEffect, { credential }) {
        return yield* Effect.provideService(
          httpEffect,
          CurrentPlatformSession,
          yield* authenticate(credential),
        );
      }),
    });
  }),
);

export const enforceAdmin = (permission: PlatformPermission) =>
  Effect.gen(function* () {
    const admin = yield* CurrentAdmin;
    if (!platformPermissions[admin.member.role].includes(permission))
      return yield* new HttpApiError.Forbidden();
    return admin;
  });
