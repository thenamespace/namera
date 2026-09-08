import { DateTime, Effect, Layer, Redacted } from "effect";
import { HttpEffect, HttpServerResponse } from "effect/unstable/http";
import { HttpApiError } from "effect/unstable/httpapi";

import { Authorization, CurrentActor } from "@namera-ai/api";
import { AuthConfig } from "@namera-ai/application";
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
    const authConfig = yield* AuthConfig;

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
      bearer: Effect.fn("server.authorization.bearer")(function* (httpEffect, { credential }) {
        yield* HttpEffect.appendPreResponseHandler((_request, response) =>
          Effect.succeed(HttpServerResponse.setHeader(response, "cache-control", "no-store")),
        );

        const now = yield* DateTime.now;
        const tokenHash = yield* crypto.hash({
          purpose: cryptoPurpose.oauthAccessToken,
          value: Redacted.value(credential),
        });
        const token = yield* repository.auth.oauth.token
          .findActiveAccessByHash(tokenHash, now)
          .pipe(Effect.orDie);
        if (token === undefined) return yield* new HttpApiError.Unauthorized();

        const client = yield* repository.auth.oauth.client
          .findById(token.clientId)
          .pipe(Effect.orDie);
        if (client === undefined || client.status !== "active")
          return yield* new HttpApiError.Unauthorized();

        const authorization = yield* repository.auth.oauth.authorization
          .findActiveById(token.authorizationId, now)
          .pipe(Effect.orDie);
        const expectedResource = new URL(authConfig.apiPublicOrigin).origin;
        if (
          authorization === undefined ||
          (authorization.type !== "cli" && authorization.type !== "mcp") ||
          authorization.actorId === undefined ||
          authorization.clientId !== token.clientId ||
          authorization.resource !== expectedResource ||
          token.resource !== expectedResource
        ) {
          return yield* new HttpApiError.Unauthorized();
        }

        const grants = yield* repository.core.sessionKeyGrant
          .findActiveForActor(authorization.organizationId, authorization.actorId)
          .pipe(Effect.orDie);
        const actor: CurrentActorResponse = {
          type: authorization.type,
          data: {
            actorId: authorization.actorId,
            organizationId: authorization.organizationId,
            authorization: {
              id: authorization.id,
              clientId: authorization.clientId,
              // Refresh may narrow a token below its durable authorization.
              scopes: token.scopes.filter((scope) => authorization.scopes.includes(scope)),
              metadata: authorization.metadata,
              expiresAt: authorization.expiresAt,
              lastUsedAt: authorization.lastUsedAt,
              createdAt: authorization.createdAt,
            },
            grants,
          },
        };

        yield* Effect.all([
          repository.auth.oauth.token.touchLastUsed(token.id, now),
          repository.auth.oauth.authorization.touchLastUsed(authorization.id, now),
        ]).pipe(Effect.orDie);

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
