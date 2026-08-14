import { DateTime, Effect, Metric, Schema } from "effect";

import { CryptoService } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
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
import type { EvmSessionKey, EvmSessionKeyPolicies } from "@namera-ai/protocol/model";
import { sessionKeyCreationDuration, sessionKeyCreationResults } from "@namera-ai/telemetry";
import { generateUniqueId } from "@namera-ai/utils";

import { Audit } from "#/audit/layer";
import { makeCreateNotification } from "#/notification/create";
import { notificationPolicy } from "#/notification/data";

import { hashSessionKeyPolicies } from "./hash.js";

export interface SessionKeyApplication {
  readonly create: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly request: CreateSessionKeyRequest;
  }) => Effect.Effect<EvmSessionKey, WalletNotFoundError | SessionKeyCreationError>;
  readonly get: (
    organizationId: OrganizationId,
    sessionKeyId: SessionKeyId,
  ) => Effect.Effect<EvmSessionKey, SessionKeyNotFoundError>;
  readonly listForWallet: (
    organizationId: OrganizationId,
    walletId: WalletId,
  ) => Effect.Effect<ReadonlyArray<EvmSessionKey>, WalletNotFoundError>;
  readonly listForOrganization: (
    organizationId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<EvmSessionKey>>;
}

export const makeSessionKeyApplication = Effect.gen(function* () {
  const audit = yield* Audit;
  const crypto = yield* CryptoService;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const createNotification = yield* makeCreateNotification;

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
      if (
        input.request.policies.some(
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

      const policies: EvmSessionKeyPolicies = input.request.policies.map((policy) => ({
        ...policy,
        id: Schema.decodeSync(PolicyId)(generateUniqueId()),
      }));
      const policyHash = yield* hashSessionKeyPolicies(crypto, policies);
      const effectiveExpiry = policies
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
              policyTypes: created.policies.map((policy) => policy.type),
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
              policyTypes: created.policies.map((policy) => policy.type),
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
      return sessionKey;
    },
    Effect.trackDuration(sessionKeyCreationDuration),
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const get = Effect.fn("application.sessionKey.get")(
    function* (organizationId: OrganizationId, sessionKeyId: SessionKeyId) {
      const sessionKey = yield* repository.core.sessionKey.findById(sessionKeyId, organizationId);
      if (sessionKey === undefined) {
        return yield* new SessionKeyNotFoundError({ code: "SESSION_KEY_NOT_FOUND" });
      }
      return sessionKey;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const listForWallet = Effect.fn("application.sessionKey.listForWallet")(
    function* (organizationId: OrganizationId, walletId: WalletId) {
      const wallet = yield* repository.core.wallet.findById(walletId, organizationId);
      if (wallet === undefined) {
        return yield* new WalletNotFoundError({ code: "WALLET_NOT_FOUND" });
      }
      return yield* repository.core.sessionKey.findForWallet(organizationId, walletId);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const listForOrganization = Effect.fn("application.sessionKey.listForOrganization")(
    function* (organizationId: OrganizationId) {
      return yield* repository.core.sessionKey.findForOrganization(organizationId);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { create, get, listForWallet, listForOrganization } satisfies SessionKeyApplication;
});
