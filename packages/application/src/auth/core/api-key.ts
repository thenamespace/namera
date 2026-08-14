import { DateTime, Effect, Metric } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import {
  ApiKeyCreationError,
  ApiKeyNotFoundError,
  SessionKeyNotFoundError,
  type ActorId,
  type ApiKeyId,
  type OrganizationId,
} from "@namera-ai/protocol";
import type { CreateApiKeyRequest } from "@namera-ai/protocol/dto";
import type {
  ApiKey,
  OrganizationMember,
  OrganizationRole,
  SessionKey,
  User,
} from "@namera-ai/protocol/model";
import { apiKeyCreationDuration, apiKeyCreationResults } from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";
import { makeCreateNotification } from "#/notification/create";
import { notificationPolicy } from "#/notification/data";

import { authPolicy } from "../data.js";

export interface ApiKeyView {
  readonly apiKey: ApiKey;
  readonly sessionKeys: ReadonlyArray<SessionKey>;
  readonly creator: {
    readonly organizationMember: OrganizationMember;
    readonly organizationRole: OrganizationRole;
    readonly user: User;
  };
}

export interface ApiKeyApplication {
  readonly create: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly request: CreateApiKeyRequest;
  }) => Effect.Effect<
    { readonly apiKey: ApiKeyView; readonly key: string },
    ApiKeyCreationError | SessionKeyNotFoundError
  >;
  readonly get: (
    organizationId: OrganizationId,
    apiKeyId: ApiKeyId,
  ) => Effect.Effect<ApiKeyView, ApiKeyNotFoundError>;
  readonly list: (organizationId: OrganizationId) => Effect.Effect<ReadonlyArray<ApiKeyView>>;
}

export const makeApiKeyApplication = Effect.gen(function* () {
  const audit = yield* Audit;
  const crypto = yield* CryptoService;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const createNotification = yield* makeCreateNotification;

  const loadViews = Effect.fnUntraced(function* (
    organizationId: OrganizationId,
    apiKeys: ReadonlyArray<ApiKey>,
  ) {
    if (apiKeys.length === 0) return [];

    const [grants, creators] = yield* Effect.all([
      repository.core.sessionKeyGrant.findActiveForActors(
        organizationId,
        apiKeys.map(({ actorId }) => actorId),
      ),
      repository.auth.member.findByActorIds(organizationId, [
        ...new Set(apiKeys.map(({ createdByActorId }) => createdByActorId)),
      ]),
    ]);
    const creatorByActorId = new Map(
      creators.map((creator) => [creator.organizationMember.actorId, creator]),
    );

    const views: Array<ApiKeyView> = [];
    for (const apiKey of apiKeys) {
      const creator = creatorByActorId.get(apiKey.createdByActorId);
      if (creator === undefined) return yield* Effect.die("API-key creator relation is missing");
      views.push({
        apiKey,
        creator,
        sessionKeys: grants
          .filter(({ grant }) => grant.actorId === apiKey.actorId)
          .map(({ sessionKey }) => sessionKey),
      });
    }
    return views;
  });

  const create = Effect.fn("application.apiKey.create")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId: ActorId;
      readonly request: CreateApiKeyRequest;
    }) {
      const now = yield* DateTime.now;
      if (
        input.request.expiresAt !== null &&
        DateTime.toEpochMillis(input.request.expiresAt) <= DateTime.toEpochMillis(now)
      ) {
        yield* Metric.update(
          Metric.withAttributes(apiKeyCreationResults, { result: "expiry_in_past" }),
          1,
        );
        return yield* new ApiKeyCreationError({ code: "EXPIRY_IN_PAST" });
      }

      const sessionKeyIds = [...new Set(input.request.sessionKeyIds)];
      const sessionKeys = yield* Effect.forEach(sessionKeyIds, (sessionKeyId) =>
        repository.core.sessionKey
          .findById(sessionKeyId, input.organizationId)
          .pipe(
            Effect.flatMap((sessionKey) =>
              sessionKey === undefined
                ? new SessionKeyNotFoundError({ code: "SESSION_KEY_NOT_FOUND" })
                : Effect.succeed(sessionKey),
            ),
          ),
      );
      if (sessionKeys.some((sessionKey) => sessionKey.status !== "active")) {
        yield* Metric.update(
          Metric.withAttributes(apiKeyCreationResults, { result: "session_key_not_active" }),
          1,
        );
        return yield* new ApiKeyCreationError({ code: "SESSION_KEY_NOT_ACTIVE" });
      }

      const key = `${authPolicy.apiKey.prefix}${yield* crypto.randomToken(authPolicy.apiKey.tokenBytes)}`;
      const keyHash = yield* crypto.hash({ purpose: cryptoPurpose.apiKey, value: key });
      const created = yield* transaction.run(
        Effect.gen(function* () {
          const actor = yield* repository.auth.actor.insert({
            organizationId: input.organizationId,
            type: "api-key",
          });
          const apiKey = yield* repository.auth.apiKey.insert({
            organizationId: input.organizationId,
            actorId: actor.id,
            createdByActorId: input.actorId,
            metadata: input.request.metadata,
            keyHash,
            keyStart: key.slice(0, authPolicy.apiKey.visiblePrefixLength),
            expiresAt: input.request.expiresAt,
          });
          yield* repository.core.sessionKeyGrant.insertMany(
            sessionKeys.map((sessionKey) => ({
              organizationId: input.organizationId,
              actorId: actor.id,
              sessionKeyId: sessionKey.id,
              grantedByActorId: input.actorId,
            })),
          );
          const event = yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "api_key.created",
            resourceType: "api-key",
            resourceId: apiKey.id,
            data: { version: 1, sessionKeyIds },
          });
          const organization = yield* repository.auth.organization.findById(input.organizationId);
          if (organization === undefined) {
            return yield* Effect.die("API-key organization disappeared during creation");
          }
          const members = yield* repository.auth.member.findOrganizationMembersForOrg(
            input.organizationId,
          );
          yield* createNotification({
            organizationId: input.organizationId,
            actorId: input.actorId,
            type: "api_key.created",
            resourceType: "api-key",
            resourceId: apiKey.id,
            data: { version: 1, sessionKeyCount: sessionKeys.length },
            idempotencyKey: `notification:api_key.created:${apiKey.id}`,
            correlationId: event.correlationId,
            expiresAt: null,
            recipients: members
              .filter(({ organizationRole }) =>
                organizationRole.permissions.includes("api-key:read"),
              )
              .map(({ user }) => ({
                userId: user.id,
                email: {
                  type: "api-key-created" as const,
                  to: user.email,
                  expiresAt: DateTime.addDuration(
                    now,
                    notificationPolicy["api_key.created"].emailTimeToLive,
                  ),
                  variables: {
                    apiKeyName: apiKey.metadata.name,
                    organizationName: organization.metadata.name,
                    sessionKeyCount: sessionKeys.length,
                  },
                },
              })),
          });
          return apiKey;
        }),
      );

      yield* Metric.update(Metric.withAttributes(apiKeyCreationResults, { result: "success" }), 1);
      yield* Effect.logInfo("api_key.created").pipe(
        Effect.annotateLogs({ session_key_count: sessionKeys.length }),
      );
      const [apiKey] = yield* loadViews(input.organizationId, [created]);
      if (apiKey === undefined) return yield* Effect.die("Created API key could not be loaded");
      return { apiKey: { ...apiKey, sessionKeys }, key };
    },
    Effect.trackDuration(apiKeyCreationDuration),
    Effect.tapErrorTag("SessionKeyError", () =>
      Metric.update(
        Metric.withAttributes(apiKeyCreationResults, { result: "session_key_missing" }),
        1,
      ),
    ),
    Effect.tapErrorTag("DatabaseError", () =>
      Metric.update(
        Metric.withAttributes(apiKeyCreationResults, { result: "persistence_failed" }),
        1,
      ),
    ),
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const get = Effect.fn("application.apiKey.get")(
    function* (organizationId: OrganizationId, apiKeyId: ApiKeyId) {
      const apiKey = yield* repository.auth.apiKey.findById(apiKeyId, organizationId);
      if (apiKey === undefined) {
        return yield* new ApiKeyNotFoundError({ code: "API_KEY_NOT_FOUND" });
      }
      const [view] = yield* loadViews(organizationId, [apiKey]);
      if (view === undefined) return yield* Effect.die("API-key view could not be loaded");
      return view;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const list = Effect.fn("application.apiKey.list")(
    function* (organizationId: OrganizationId) {
      const apiKeys = yield* repository.auth.apiKey.findForOrganization(organizationId);
      return yield* loadViews(organizationId, apiKeys);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { create, get, list } satisfies ApiKeyApplication;
});
