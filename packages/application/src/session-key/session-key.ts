import { DateTime, Effect, Metric, Schema } from "effect";

import { CryptoService } from "@namera-ai/crypto";
import { Repository, TransactionService, type WalletView } from "@namera-ai/database";
import {
  PolicyId,
  SessionKeyCreationError,
  SessionKeyNotFoundError,
  WalletNotFoundError,
  type ActorId,
  type OrganizationId,
  type SessionKeyId,
  type WalletId,
} from "@namera-ai/protocol";
import type { CreateSessionKeyRequest } from "@namera-ai/protocol/dto";
import type {
  EvmSessionKey,
  EvmSessionKeyPolicies,
  OrganizationMember,
  OrganizationRole,
  User,
} from "@namera-ai/protocol/model";
import {
  sessionKeyCreationDuration,
  sessionKeyCreationResults,
  sessionKeyRevocationDuration,
  sessionKeyRevocationResults,
} from "@namera-ai/telemetry";
import { generateUniqueId } from "@namera-ai/utils";

import { Audit } from "#/audit/layer";
import { makeCreateNotification } from "#/notification/create";
import { notificationPolicy } from "#/notification/data";

import { hashSessionKeyPolicies } from "./hash.js";

export interface SessionKeyView {
  readonly sessionKey: EvmSessionKey;
  readonly wallet: WalletView;
  readonly creator: {
    readonly organizationMember: OrganizationMember;
    readonly organizationRole: OrganizationRole;
    readonly user: User;
  };
}

export interface SessionKeyApplication {
  readonly create: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly request: CreateSessionKeyRequest;
  }) => Effect.Effect<SessionKeyView, WalletNotFoundError | SessionKeyCreationError>;
  readonly get: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
    readonly sessionKeyId: SessionKeyId;
  }) => Effect.Effect<SessionKeyView, SessionKeyNotFoundError>;
  readonly listForWallet: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
    readonly walletId: WalletId;
  }) => Effect.Effect<ReadonlyArray<SessionKeyView>, WalletNotFoundError>;
  readonly listForOrganization: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
  }) => Effect.Effect<ReadonlyArray<SessionKeyView>>;
  readonly revoke: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly sessionKeyId: SessionKeyId;
  }) => Effect.Effect<SessionKeyView, SessionKeyNotFoundError>;
}

export const makeSessionKeyApplication = Effect.gen(function* () {
  const audit = yield* Audit;
  const crypto = yield* CryptoService;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const createNotification = yield* makeCreateNotification;

  const loadViews = Effect.fnUntraced(function* (
    organizationId: OrganizationId,
    sessionKeys: ReadonlyArray<EvmSessionKey>,
  ) {
    if (sessionKeys.length === 0) return [];

    const [wallets, creators] = yield* Effect.all([
      repository.core.wallet.findForOrganization(organizationId),
      repository.auth.member.findByActorIds(organizationId, [
        ...new Set(sessionKeys.map((sessionKey) => sessionKey.createdByActorId)),
      ]),
    ]);
    const walletById = new Map(wallets.map((wallet) => [wallet.wallet.id, wallet]));
    const creatorByActorId = new Map(
      creators.map((creator) => [creator.organizationMember.actorId, creator]),
    );

    const views: Array<SessionKeyView> = [];
    for (const sessionKey of sessionKeys) {
      const wallet = walletById.get(sessionKey.walletId);
      const creator = creatorByActorId.get(sessionKey.createdByActorId);
      if (wallet === undefined || creator === undefined) {
        return yield* Effect.die("Session-key response relation is missing");
      }
      views.push({ sessionKey, wallet, creator });
    }
    return views;
  });

  const create = Effect.fn("application.sessionKey.create")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId: ActorId;
      readonly request: CreateSessionKeyRequest;
    }) {
      const creationResults = Metric.withAttributes(sessionKeyCreationResults, {
        namespace: input.request.namespace,
      });
      const now = yield* DateTime.now;
      const timeWindows = input.request.policies.filter(
        (policy) => policy.type === "evm.time-window",
      );
      if (
        timeWindows.some(
          (policy) => DateTime.toEpochMillis(policy.expiresAt) <= DateTime.toEpochMillis(now),
        )
      ) {
        yield* Metric.update(
          Metric.withAttributes(creationResults, { result: "time_window_expired" }),
          1,
        );
        return yield* new SessionKeyCreationError({ code: "TIME_WINDOW_EXPIRED" });
      }

      const wallet = yield* repository.core.wallet.findById(
        input.request.walletId,
        input.organizationId,
      );
      if (wallet === undefined) {
        yield* Metric.update(
          Metric.withAttributes(creationResults, { result: "wallet_missing" }),
          1,
        );
        return yield* new WalletNotFoundError({ code: "WALLET_NOT_FOUND" });
      }
      if (wallet.wallet.status !== "active") {
        yield* Metric.update(
          Metric.withAttributes(creationResults, { result: "wallet_not_active" }),
          1,
        );
        return yield* new SessionKeyCreationError({ code: "WALLET_NOT_ACTIVE" });
      }
      if (wallet.wallet.namespace !== input.request.namespace) {
        yield* Metric.update(
          Metric.withAttributes(creationResults, { result: "namespace_mismatch" }),
          1,
        );
        return yield* new SessionKeyCreationError({ code: "WALLET_NAMESPACE_MISMATCH" });
      }

      const policies = input.request.policies.map((policy) => {
        const id = Schema.decodeSync(PolicyId)(generateUniqueId());
        switch (policy.type) {
          case "evm.native-spend-limit":
            return { ...policy, id, appliesTo: "execution" } as const;
          case "evm.time-window":
            return { ...policy, id, appliesTo: "both" } as const;
          case "evm.signature":
            return { ...policy, id, appliesTo: "signature" } as const;
        }
      }) satisfies EvmSessionKeyPolicies;
      const policyHash = yield* hashSessionKeyPolicies(crypto, policies);
      const policyTypes = policies.map((policy) => policy.type);
      const effectiveExpiry = policies
        .filter((policy) => policy.type === "evm.time-window")
        .map((policy) => policy.expiresAt)
        .reduce((earliest, expiresAt) =>
          DateTime.toEpochMillis(expiresAt) < DateTime.toEpochMillis(earliest)
            ? expiresAt
            : earliest,
        );

      const sessionKey = yield* transaction.run(
        Effect.gen(function* () {
          const created = yield* repository.core.sessionKey.insert({
            organizationId: input.organizationId,
            walletId: wallet.wallet.id,
            createdByActorId: input.actorId,
            namespace: input.request.namespace,
            metadata: input.request.metadata,
            policies,
            policyHash,
          });
          const event = yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "session_key.created",
            resourceType: "session-key",
            resourceId: created.id,
            data: {
              version: 1,
              walletId: created.walletId,
              namespace: created.namespace,
              policyTypes,
            },
          });
          const organization = yield* repository.auth.organization.findById(input.organizationId);
          if (organization === undefined) {
            return yield* Effect.die("Session-key organization disappeared during creation");
          }
          const members = yield* repository.auth.member.findOrganizationMembersForOrg(
            input.organizationId,
          );
          const configuredEmailExpiry = DateTime.addDuration(
            now,
            notificationPolicy["session_key.created"].emailTimeToLive,
          );
          const emailExpiry =
            DateTime.toEpochMillis(effectiveExpiry) < DateTime.toEpochMillis(configuredEmailExpiry)
              ? effectiveExpiry
              : configuredEmailExpiry;
          yield* createNotification({
            organizationId: input.organizationId,
            actorId: input.actorId,
            type: "session_key.created",
            resourceType: "session-key",
            resourceId: created.id,
            data: {
              version: 1,
              walletId: created.walletId,
              namespace: created.namespace,
              policyTypes,
            },
            idempotencyKey: `notification:session_key.created:${created.id}`,
            correlationId: event.correlationId,
            expiresAt: effectiveExpiry,
            recipients: members
              .filter(({ organizationRole }) =>
                organizationRole.permissions.includes("session-key:read"),
              )
              .map(({ user }) => ({
                userId: user.id,
                email: {
                  type: "session-key-created" as const,
                  to: user.email,
                  expiresAt: emailExpiry,
                  variables: {
                    sessionKeyName: created.metadata.name,
                    walletName: wallet.wallet.metadata.name,
                    organizationName: organization.metadata.name,
                    expiresAt: DateTime.formatIso(effectiveExpiry),
                  },
                },
              })),
          });
          return created;
        }),
      );

      yield* Metric.update(Metric.withAttributes(creationResults, { result: "success" }), 1);
      yield* Effect.logInfo("session_key.created").pipe(
        Effect.annotateLogs({ namespace: sessionKey.namespace, policy_count: policies.length }),
      );
      const [view] = yield* loadViews(input.organizationId, [sessionKey]);
      if (view === undefined) return yield* Effect.die("Created session key could not be loaded");
      return view;
    },
    Effect.trackDuration(sessionKeyCreationDuration),
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const get = Effect.fn("application.sessionKey.get")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId?: ActorId;
      readonly sessionKeyId: SessionKeyId;
    }) {
      const sessionKey = yield* input.actorId === undefined
        ? repository.core.sessionKey.findById(input.sessionKeyId, input.organizationId)
        : repository.core.sessionKey.findByIdForActor(
            input.sessionKeyId,
            input.organizationId,
            input.actorId,
          );
      if (sessionKey === undefined) {
        return yield* new SessionKeyNotFoundError({ code: "SESSION_KEY_NOT_FOUND" });
      }
      const [view] = yield* loadViews(input.organizationId, [sessionKey]);
      if (view === undefined) return yield* Effect.die("Session key view could not be loaded");
      return view;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const listForWallet = Effect.fn("application.sessionKey.listForWallet")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId?: ActorId;
      readonly walletId: WalletId;
    }) {
      const wallet = yield* input.actorId === undefined
        ? repository.core.wallet.findById(input.walletId, input.organizationId)
        : repository.core.wallet.findByIdForActor(
            input.walletId,
            input.organizationId,
            input.actorId,
          );
      if (wallet === undefined) {
        return yield* new WalletNotFoundError({ code: "WALLET_NOT_FOUND" });
      }
      const sessionKeys = yield* input.actorId === undefined
        ? repository.core.sessionKey.findForWallet(input.organizationId, input.walletId)
        : repository.core.sessionKey.findForWalletAndActor(
            input.organizationId,
            input.walletId,
            input.actorId,
          );
      return yield* loadViews(input.organizationId, sessionKeys);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const listForOrganization = Effect.fn("application.sessionKey.listForOrganization")(
    function* (input: { readonly organizationId: OrganizationId; readonly actorId?: ActorId }) {
      const sessionKeys = yield* input.actorId === undefined
        ? repository.core.sessionKey.findForOrganization(input.organizationId)
        : repository.core.sessionKey.findForActor(input.organizationId, input.actorId);
      return yield* loadViews(input.organizationId, sessionKeys);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const revoke = Effect.fn("application.sessionKey.revoke")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId: ActorId;
      readonly sessionKeyId: SessionKeyId;
    }) {
      const now = yield* DateTime.now;
      const result = yield* transaction.run(
        Effect.gen(function* () {
          const revoked = yield* repository.core.sessionKey.revoke(
            input.sessionKeyId,
            input.organizationId,
            input.actorId,
            now,
          );
          if (revoked === undefined) {
            const existing = yield* repository.core.sessionKey.findById(
              input.sessionKeyId,
              input.organizationId,
            );
            if (existing === undefined) {
              return yield* new SessionKeyNotFoundError({ code: "SESSION_KEY_NOT_FOUND" });
            }
            return { sessionKey: existing, result: "already_revoked" as const };
          }

          const revokedGrants = yield* repository.core.sessionKeyGrant.revokeActiveForSessionKey(
            input.organizationId,
            revoked.id,
            input.actorId,
            now,
          );
          const event = yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "session_key.revoked",
            resourceType: "session-key",
            resourceId: revoked.id,
            data: {
              version: 1,
              walletId: revoked.walletId,
              namespace: revoked.namespace,
              revokedGrantCount: revokedGrants.length,
            },
          });
          const organization = yield* repository.auth.organization.findById(input.organizationId);
          const wallet = yield* repository.core.wallet.findById(
            revoked.walletId,
            input.organizationId,
          );
          if (organization === undefined || wallet === undefined) {
            return yield* Effect.die("Session-key relations disappeared during revocation");
          }
          const members = yield* repository.auth.member.findOrganizationMembersForOrg(
            input.organizationId,
          );
          yield* createNotification({
            organizationId: input.organizationId,
            actorId: input.actorId,
            type: "session_key.revoked",
            resourceType: "session-key",
            resourceId: revoked.id,
            data: {
              version: 1,
              walletId: revoked.walletId,
              namespace: revoked.namespace,
              revokedGrantCount: revokedGrants.length,
            },
            idempotencyKey: `notification:session_key.revoked:${revoked.id}`,
            correlationId: event.correlationId,
            expiresAt: null,
            recipients: members
              .filter(({ organizationRole }) =>
                organizationRole.permissions.includes("session-key:read"),
              )
              .map(({ user }) => ({
                userId: user.id,
                email: {
                  type: "session-key-revoked" as const,
                  to: user.email,
                  expiresAt: DateTime.addDuration(
                    now,
                    notificationPolicy["session_key.revoked"].emailTimeToLive,
                  ),
                  variables: {
                    sessionKeyName: revoked.metadata.name,
                    walletName: wallet.wallet.metadata.name,
                    organizationName: organization.metadata.name,
                    revokedGrantCount: revokedGrants.length,
                  },
                },
              })),
          });
          return { sessionKey: revoked, result: "success" as const };
        }),
      );

      yield* Metric.update(
        Metric.withAttributes(sessionKeyRevocationResults, { result: result.result }),
        1,
      );
      if (result.result === "success") {
        yield* Effect.logInfo("session_key.revoked").pipe(
          Effect.annotateLogs({ namespace: result.sessionKey.namespace }),
        );
      }
      const [view] = yield* loadViews(input.organizationId, [result.sessionKey]);
      if (view === undefined) return yield* Effect.die("Revoked session key could not be loaded");
      return view;
    },
    Effect.trackDuration(sessionKeyRevocationDuration),
    Effect.tapErrorTag("SessionKeyError", () =>
      Metric.update(Metric.withAttributes(sessionKeyRevocationResults, { result: "not_found" }), 1),
    ),
    Effect.tapErrorTag("DatabaseError", () =>
      Metric.update(
        Metric.withAttributes(sessionKeyRevocationResults, { result: "persistence_failed" }),
        1,
      ),
    ),
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return {
    create,
    get,
    listForWallet,
    listForOrganization,
    revoke,
  } satisfies SessionKeyApplication;
});
