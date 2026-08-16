import { DateTime, Effect, Layer, Redacted } from "effect";
import { HttpEffect, HttpServerResponse } from "effect/unstable/http";
import { HttpApiError } from "effect/unstable/httpapi";

import { Authorization, CurrentActor } from "@namera-ai/api";
import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import type { CurrentActorResponse } from "@namera-ai/protocol/dto";

import { AuthCookieConfig, clearAuthCookie } from "#/helpers/auth-cookie";
import {
  toMemberResponse,
  toOrganizationResponse,
  toRoleResponse,
  toSessionResponse,
  toUserResponse,
} from "#/helpers/dto";

export const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const crypto = yield* CryptoService;
    const repository = yield* Repository;
    const cookieConfig = yield* AuthCookieConfig;

    return Authorization.of({
      // Machine actors carry their active grants in CurrentActor so downstream
      // routes can derive wallets and session keys without trusting client input.
      apiKey: Effect.fn("server.authorization.apiKey")(function* (httpEffect, { credential }) {
        yield* HttpEffect.appendPreResponseHandler((_request, response) =>
          Effect.succeed(HttpServerResponse.setHeader(response, "cache-control", "no-store")),
        );
        const keyHash = yield* crypto.hash({
          purpose: cryptoPurpose.apiKey,
          value: Redacted.value(credential),
        });
        const apiKey = yield* repository.auth.apiKey
          .authenticate(keyHash, yield* DateTime.now)
          .pipe(Effect.orDie);
        if (apiKey === undefined) return yield* new HttpApiError.Unauthorized();

        const grants = yield* repository.core.sessionKeyGrant
          .findActiveForActor(apiKey.organizationId, apiKey.actorId)
          .pipe(Effect.orDie);
        const actor: CurrentActorResponse = {
          type: "api-key",
          data: {
            actorId: apiKey.actorId,
            organizationId: apiKey.organizationId,
            apiKey: {
              id: apiKey.id,
              metadata: apiKey.metadata,
              keyStart: apiKey.keyStart,
              expiresAt: apiKey.expiresAt,
              lastUsedAt: apiKey.lastUsedAt,
              createdAt: apiKey.createdAt,
            },
            grants,
          },
        };
        return yield* Effect.provideService(httpEffect, CurrentActor, actor);
      }),
      // A user session is valid only while its active organization membership
      // remains active. Removing the member therefore invalidates authorization
      // immediately without waiting for the session token to expire.
      authToken: Effect.fn("server.authorization.authToken")(function* (
        httpEffect,
        { credential },
      ) {
        yield* HttpEffect.appendPreResponseHandler((_request, response) =>
          Effect.succeed(HttpServerResponse.setHeader(response, "cache-control", "no-store")),
        );
        const tokenHash = yield* crypto.hash({
          purpose: cryptoPurpose.sessionToken,
          value: Redacted.value(credential),
        });
        const now = yield* DateTime.now;
        const session = yield* repository.auth.session
          .findActiveByTokenHash(tokenHash, now)
          .pipe(Effect.orDie);

        if (session === undefined || session.activeOrganizationId === null) {
          yield* clearAuthCookie(cookieConfig.secure);
          return yield* new HttpApiError.Unauthorized();
        }

        const membership = yield* repository.auth.member
          .findActiveMembership(session.userId, session.activeOrganizationId)
          .pipe(Effect.orDie);

        if (membership === undefined) {
          yield* clearAuthCookie(cookieConfig.secure);
          return yield* new HttpApiError.Unauthorized();
        }

        const user = toUserResponse(membership.user);
        const organization = toOrganizationResponse(membership.organization);
        const organizationRole = toRoleResponse(membership.organizationRole);
        const actor: CurrentActorResponse = {
          type: "user",
          data: {
            actorId: membership.organizationMember.actorId,
            session: toSessionResponse(session),
            user,
            organization,
            member: toMemberResponse(membership),
            role: organizationRole,
          },
        };

        return yield* Effect.provideService(httpEffect, CurrentActor, actor);
      }),
    });
  }),
);
