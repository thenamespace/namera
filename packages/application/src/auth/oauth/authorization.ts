import { DateTime, Effect, Metric } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import {
  OAuthAuthorizationError,
  OAuthAuthorizationRequestError,
  type ActorId,
  type OAuthAuthorizationId,
  type OrganizationId,
  type UserId,
} from "@namera-ai/protocol";
import type {
  OAuthAuthorization,
  OAuthClient,
  OAuthAuthorizationType,
  OrganizationMember,
  OrganizationRole,
  SessionKey,
  User,
} from "@namera-ai/protocol/model";
import {
  oauthAuthorizationRevocationDuration,
  oauthAuthorizationRevocationResults,
  oauthConsentDuration,
  oauthConsentResults,
} from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";
import { makeCreateNotification } from "#/notification/create";

export interface OAuthAuthorizationView {
  readonly authorization: OAuthAuthorization;
  readonly client: OAuthClient;
  readonly authorizedBy: {
    readonly organizationMember: OrganizationMember;
    readonly organizationRole: OrganizationRole;
    readonly user: User;
  };
  readonly sessionKeys: ReadonlyArray<SessionKey>;
}

export const makeOAuthAuthorizationApplication = Effect.gen(function* () {
  const audit = yield* Audit;
  const config = yield* AuthConfig;
  const crypto = yield* CryptoService;
  const createNotification = yield* makeCreateNotification;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;

  const loadViews = Effect.fnUntraced(function* (
    organizationId: OrganizationId,
    authorizations: ReadonlyArray<OAuthAuthorization>,
  ) {
    if (authorizations.length === 0) return [];
    const [clients, authorizers, grants] = yield* Effect.all([
      Effect.forEach(
        [...new Set(authorizations.map(({ clientId }) => clientId))],
        repository.auth.oauth.client.findById,
      ),
      repository.auth.member.findByActorIds(organizationId, [
        ...new Set(authorizations.map(({ authorizedByActorId }) => authorizedByActorId)),
      ]),
      repository.core.sessionKeyGrant.findActiveForActors(
        organizationId,
        authorizations.map(({ actorId }) => actorId),
      ),
    ]);
    const clientById = new Map(clients.flatMap((client) => (client ? [[client.id, client]] : [])));
    const authorizerByActorId = new Map(
      authorizers.map((authorizer) => [authorizer.organizationMember.actorId, authorizer]),
    );
    return yield* Effect.forEach(authorizations, (authorization) =>
      Effect.gen(function* () {
        const client = clientById.get(authorization.clientId);
        const authorizedBy = authorizerByActorId.get(authorization.authorizedByActorId);
        if (client === undefined || authorizedBy === undefined) {
          return yield* Effect.die("OAuth authorization relation is missing");
        }
        return {
          authorization,
          client,
          authorizedBy,
          sessionKeys: grants
            .filter(({ grant }) => grant.actorId === authorization.actorId)
            .map(({ sessionKey }) => sessionKey),
        } satisfies OAuthAuthorizationView;
      }),
    );
  });

  const approve = Effect.fn("application.oauth.authorization.approve")(
    function* (input: {
      readonly requestId: Parameters<
        typeof repository.auth.oauth.authorizationRequest.findPendingById
      >[0];
      readonly organizationId: OrganizationId;
      readonly userId: UserId;
      readonly actorId: ActorId;
      readonly sessionKeyIds: ReadonlyArray<SessionKey["id"]>;
      readonly expiresAt: DateTime.Utc | null;
    }) {
      const now = yield* DateTime.now;
      if (
        input.expiresAt !== null &&
        DateTime.toEpochMillis(input.expiresAt) <= DateTime.toEpochMillis(now)
      ) {
        return yield* new OAuthAuthorizationRequestError({ code: "INVALID_REQUEST" });
      }
      const pending = yield* repository.auth.oauth.authorizationRequest.findPendingById(
        input.requestId,
        now,
      );
      if (pending === undefined) {
        return yield* new OAuthAuthorizationRequestError({ code: "REQUEST_NOT_FOUND" });
      }
      const client = yield* repository.auth.oauth.client.findById(pending.clientId);
      if (client === undefined || client.status !== "active") {
        return yield* new OAuthAuthorizationRequestError({ code: "INVALID_CLIENT" });
      }

      const sessionKeyIds = [...new Set(input.sessionKeyIds)];
      const sessionKeys = yield* Effect.forEach(sessionKeyIds, (sessionKeyId) =>
        repository.core.sessionKey.findById(sessionKeyId, input.organizationId),
      );
      if (sessionKeys.some((sessionKey) => sessionKey === undefined)) {
        return yield* new OAuthAuthorizationError({ code: "SESSION_KEY_NOT_FOUND" });
      }
      if (sessionKeys.some((sessionKey) => sessionKey?.status !== "active")) {
        return yield* new OAuthAuthorizationError({ code: "SESSION_KEY_NOT_ACTIVE" });
      }

      const code = yield* crypto.randomToken(config.oauth.tokenBytes);
      const codeHash = yield* crypto.hash({
        purpose: cryptoPurpose.oauthAuthorizationCode,
        value: code,
      });
      const authorization = yield* transaction.run(
        Effect.gen(function* () {
          const approved = yield* repository.auth.oauth.authorizationRequest.approve({
            id: pending.id,
            userId: input.userId,
            organizationId: input.organizationId,
            now,
          });
          if (approved === undefined) {
            return yield* new OAuthAuthorizationRequestError({ code: "REQUEST_NOT_FOUND" });
          }
          const actor = yield* repository.auth.actor.insert({
            organizationId: input.organizationId,
            type: "mcp",
          });
          const created = yield* repository.auth.oauth.authorization.insert({
            organizationId: input.organizationId,
            actorId: actor.id,
            clientId: client.id,
            type: "mcp",
            authorizedByActorId: input.actorId,
            scopes: pending.requestedScopes,
            resource: pending.resource,
            status: "active",
            expiresAt: input.expiresAt,
            metadata: { type: "mcp", version: 1 },
          });
          yield* repository.core.sessionKeyGrant.insertMany(
            sessionKeyIds.map((sessionKeyId) => ({
              organizationId: input.organizationId,
              actorId: actor.id,
              sessionKeyId,
              grantedByActorId: input.actorId,
            })),
          );
          yield* repository.auth.oauth.authorizationCode.insert({
            authorizationId: created.id,
            clientId: client.id,
            codeHash,
            redirectUri: pending.redirectUri,
            codeChallenge: pending.codeChallenge,
            codeChallengeMethod: "S256",
            resource: pending.resource,
            scopes: pending.requestedScopes,
            expiresAt: DateTime.addDuration(now, config.oauth.authorizationCodeTimeToLive),
          });
          const event = yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "mcp_authorization.approved",
            resourceType: "mcp-authorization",
            resourceId: created.id,
            data: { version: 1, clientId: client.id, sessionKeyIds },
          });
          const members = yield* repository.auth.member.findOrganizationMembersForOrg(
            input.organizationId,
          );
          yield* createNotification({
            organizationId: input.organizationId,
            actorId: input.actorId,
            type: "mcp_authorization.approved",
            resourceType: "mcp-authorization",
            resourceId: created.id,
            data: {
              version: 1,
              clientName: client.clientName,
              sessionKeyCount: sessionKeyIds.length,
            },
            idempotencyKey: `notification:mcp_authorization.approved:${created.id}`,
            correlationId: event.correlationId,
            expiresAt: null,
            recipients: members
              .filter(({ organizationRole }) =>
                organizationRole.permissions.includes("mcp-authorization:read"),
              )
              .map(({ user }) => ({ userId: user.id })),
          });
          return created;
        }),
      );

      const redirectUrl = new URL(pending.redirectUri);
      redirectUrl.searchParams.set("code", code);
      if (pending.state !== null) redirectUrl.searchParams.set("state", pending.state);
      yield* Metric.update(Metric.withAttributes(oauthConsentResults, { result: "approved" }), 1);
      yield* Effect.logInfo("oauth.authorization.approved");
      return { authorization, redirectUrl: redirectUrl.toString() };
    },
    Effect.trackDuration(oauthConsentDuration),
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const deny = Effect.fn("application.oauth.authorization.deny")(
    function* (input: {
      readonly requestId: Parameters<
        typeof repository.auth.oauth.authorizationRequest.findPendingById
      >[0];
      readonly userId: UserId;
    }) {
      const now = yield* DateTime.now;
      const pending = yield* repository.auth.oauth.authorizationRequest.findPendingById(
        input.requestId,
        now,
      );
      if (pending === undefined) {
        return yield* new OAuthAuthorizationRequestError({ code: "REQUEST_NOT_FOUND" });
      }
      const denied = yield* repository.auth.oauth.authorizationRequest.deny({
        id: pending.id,
        userId: input.userId,
        now,
      });
      if (denied === undefined) {
        return yield* new OAuthAuthorizationRequestError({ code: "REQUEST_NOT_FOUND" });
      }
      const redirectUrl = new URL(pending.redirectUri);
      redirectUrl.searchParams.set("error", "access_denied");
      if (pending.state !== null) redirectUrl.searchParams.set("state", pending.state);
      yield* Metric.update(Metric.withAttributes(oauthConsentResults, { result: "denied" }), 1);
      return { redirectUrl: redirectUrl.toString() };
    },
    Effect.trackDuration(oauthConsentDuration),
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const list = Effect.fn("application.oauth.authorization.list")(
    function* (organizationId: OrganizationId, type?: OAuthAuthorizationType) {
      return yield* loadViews(
        organizationId,
        yield* repository.auth.oauth.authorization.findForOrganization(organizationId, type),
      );
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const get = Effect.fn("application.oauth.authorization.get")(
    function* (
      organizationId: OrganizationId,
      authorizationId: OAuthAuthorizationId,
      type?: OAuthAuthorizationType,
    ) {
      const authorization = yield* repository.auth.oauth.authorization.findById(
        authorizationId,
        organizationId,
      );
      if (authorization === undefined) {
        return yield* new OAuthAuthorizationError({ code: "AUTHORIZATION_NOT_FOUND" });
      }
      if (type !== undefined && authorization.type !== type) {
        return yield* new OAuthAuthorizationError({ code: "AUTHORIZATION_NOT_FOUND" });
      }
      const [view] = yield* loadViews(organizationId, [authorization]);
      if (view === undefined)
        return yield* Effect.die("OAuth authorization view could not be loaded");
      return view;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const revoke = Effect.fn("application.oauth.authorization.revoke")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId: ActorId;
      readonly authorizationId: OAuthAuthorizationId;
      readonly type?: OAuthAuthorizationType;
    }) {
      const now = yield* DateTime.now;
      const result = yield* transaction.run(
        Effect.gen(function* () {
          const existing = yield* repository.auth.oauth.authorization.findById(
            input.authorizationId,
            input.organizationId,
          );
          if (existing === undefined) {
            return yield* new OAuthAuthorizationError({ code: "AUTHORIZATION_NOT_FOUND" });
          }
          if (input.type !== undefined && existing.type !== input.type) {
            return yield* new OAuthAuthorizationError({ code: "AUTHORIZATION_NOT_FOUND" });
          }
          if (existing.status === "revoked") return existing;
          const revoked = yield* repository.auth.oauth.authorization.revoke({
            id: input.authorizationId,
            organizationId: input.organizationId,
            revokedByActorId: input.actorId,
            revokedAt: now,
          });
          if (revoked === undefined) {
            return yield* new OAuthAuthorizationError({ code: "AUTHORIZATION_NOT_ACTIVE" });
          }
          yield* repository.auth.oauth.token.revokeAuthorization(revoked.id, now);
          const revokedGrants = yield* repository.core.sessionKeyGrant.revokeActiveForActor(
            input.organizationId,
            revoked.actorId,
            input.actorId,
            now,
          );
          const client = yield* repository.auth.oauth.client.findById(revoked.clientId);
          if (client === undefined) return yield* Effect.die("OAuth client relation is missing");
          const members = yield* repository.auth.member.findOrganizationMembersForOrg(
            input.organizationId,
          );
          if (revoked.type === "cli") {
            const deviceName =
              revoked.metadata.type === "cli" ? revoked.metadata.deviceName : "Namera CLI";
            const event = yield* audit.organization({
              organizationId: input.organizationId,
              actorId: input.actorId,
              event: "cli_authorization.revoked",
              resourceType: "cli-authorization",
              resourceId: revoked.id,
              data: {
                version: 1,
                clientId: client.id,
                deviceName,
                sessionKeyIds: revokedGrants.map(({ sessionKeyId }) => sessionKeyId),
              },
            });
            yield* createNotification({
              organizationId: input.organizationId,
              actorId: input.actorId,
              type: "cli_authorization.revoked",
              resourceType: "cli-authorization",
              resourceId: revoked.id,
              data: { version: 1, deviceName, revokedGrantCount: revokedGrants.length },
              idempotencyKey: `notification:cli_authorization.revoked:${revoked.id}`,
              correlationId: event.correlationId,
              expiresAt: null,
              recipients: members
                .filter(({ organizationRole }) =>
                  organizationRole.permissions.includes("cli-authorization:read"),
                )
                .map(({ user }) => ({ userId: user.id })),
            });
          } else {
            const event = yield* audit.organization({
              organizationId: input.organizationId,
              actorId: input.actorId,
              event: "mcp_authorization.revoked",
              resourceType: "mcp-authorization",
              resourceId: revoked.id,
              data: {
                version: 1,
                clientId: client.id,
                sessionKeyIds: revokedGrants.map(({ sessionKeyId }) => sessionKeyId),
              },
            });
            yield* createNotification({
              organizationId: input.organizationId,
              actorId: input.actorId,
              type: "mcp_authorization.revoked",
              resourceType: "mcp-authorization",
              resourceId: revoked.id,
              data: {
                version: 1,
                clientName: client.clientName,
                revokedGrantCount: revokedGrants.length,
              },
              idempotencyKey: `notification:mcp_authorization.revoked:${revoked.id}`,
              correlationId: event.correlationId,
              expiresAt: null,
              recipients: members
                .filter(({ organizationRole }) =>
                  organizationRole.permissions.includes("mcp-authorization:read"),
                )
                .map(({ user }) => ({ userId: user.id })),
            });
          }
          return revoked;
        }),
      );
      yield* Metric.update(
        Metric.withAttributes(oauthAuthorizationRevocationResults, { result: "success" }),
        1,
      );
      yield* Effect.logInfo("oauth.authorization.revoked");
      const [view] = yield* loadViews(input.organizationId, [result]);
      if (view === undefined) {
        return yield* Effect.die("Revoked OAuth authorization view is missing");
      }
      return view;
    },
    Effect.trackDuration(oauthAuthorizationRevocationDuration),
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { approve, deny, get, list, revoke };
});
