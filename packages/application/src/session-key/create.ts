import { DateTime, Effect, Encoding, Metric, Schema } from "effect";

import { CryptoService } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import {
  createPublicKeyWebAuthnAccount,
  Evm,
  findEvmPolicyCardinalityViolation,
  materializeEvmPolicy,
  resolveEvmSessionSigner,
} from "@namera-ai/evm";
import {
  PolicyId,
  SigningKeyId,
  Bytes32,
  SessionKeyCreationError,
  WalletNotFoundError,
  type ActorId,
  type OrganizationId,
} from "@namera-ai/protocol";
import type { CreateSessionKeyRequest } from "@namera-ai/protocol/dto";
import { EvmSessionInstallationData, type EvmSessionKeyPolicies } from "@namera-ai/protocol/model";
import { sessionKeyCreationDuration, sessionKeyCreationResults } from "@namera-ai/telemetry";
import { Base64, generateUniqueId } from "@namera-ai/utils";

import { Audit } from "#/audit/layer";
import { makeCreateNotification } from "#/notification/create";
import { notificationPolicy } from "#/notification/data";

import { hashSessionKeyPolicies } from "./hash.js";
import { makeLoadSessionKeyViews } from "./view.js";

export const makeCreateSessionKey = Effect.gen(function* () {
  const audit = yield* Audit;
  const crypto = yield* CryptoService;
  const repository = yield* Repository;
  const evm = yield* Evm;
  const transaction = yield* TransactionService;
  const createNotification = yield* makeCreateNotification;
  const loadViews = yield* makeLoadSessionKeyViews;

  return Effect.fn("application.sessionKey.create")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId: ActorId;
      readonly request: CreateSessionKeyRequest;
    }) {
      const creationResults = Metric.withAttributes(sessionKeyCreationResults, {
        namespace: input.request.namespace,
      });
      const now = yield* DateTime.now;
      if (input.request.onchain.validUntil <= DateTime.toEpochSeconds(now)) {
        return yield* new SessionKeyCreationError({ code: "TIME_WINDOW_EXPIRED" });
      }
      const cardinalityViolation = findEvmPolicyCardinalityViolation(input.request.policies);
      if (cardinalityViolation !== undefined) {
        yield* Metric.update(
          Metric.withAttributes(creationResults, { result: "policy_cardinality_exceeded" }),
          1,
        );
        return yield* new SessionKeyCreationError({ code: "POLICY_CARDINALITY_EXCEEDED" });
      }

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

      if (
        wallet.wallet.data.validatorType !== "webauthn_p256" ||
        wallet.signingKey.custody !== "local" ||
        wallet.signingKey.data.type !== "passkey" ||
        wallet.signingKey.status !== "active"
      ) {
        return yield* new SessionKeyCreationError({ code: "WALLET_OWNER_UNAVAILABLE" });
      }
      const signer = yield* resolveEvmSessionSigner(input.request.signer.publicKey).pipe(
        Effect.mapError(() => new SessionKeyCreationError({ code: "LOCAL_SIGNER_INVALID" })),
      );
      const signingKeyId = SigningKeyId.make(generateUniqueId());
      // Entity IDs are public routing identifiers; the database rejects reuse.
      const entityId = Number.parseInt(generateUniqueId().slice(-7), 16) + 1;
      const account = {
        wallet: wallet.wallet.data,
        owner: {
          validatorType: "webauthn_p256" as const,
          account: createPublicKeyWebAuthnAccount(wallet.signingKey.publicKeyHex),
        },
      };
      const installations = yield* Effect.forEach(
        input.request.onchain.chains,
        (chainId) =>
          Effect.gen(function* () {
            const data = yield* evm.sessions.compile({
              chainId,
              account,
              authorization: {
                version: 1,
                entityId,
                signerAddress: signer.address,
                validAfter: input.request.onchain.validAfter,
                validUntil: input.request.onchain.validUntil,
                permissions: input.request.onchain.permissions,
                allowSignatures: input.request.onchain.allowSignatures ?? false,
              },
            });
            const hash = yield* crypto.hash({
              purpose: "session-key.installation",
              value: JSON.stringify({
                walletId: wallet.wallet.id,
                signingKeyId,
                chainId,
                data: Schema.encodeSync(EvmSessionInstallationData)(data),
              }),
            });
            return {
              chainId,
              data,
              configurationHash: Bytes32.make(`0x${Encoding.encodeHex(Base64.toUint8Array(hash))}`),
            };
          }),
        { concurrency: 4 },
      ).pipe(
        Effect.catchTags({
          EvmExecutionError: (error) =>
            Effect.fail(
              new SessionKeyCreationError({
                code:
                  error.code === "NETWORK_PAUSED" ? "NETWORK_PAUSED" : "ONCHAIN_PREPARATION_FAILED",
              }),
            ),
          UnsupportedChainError: () =>
            Effect.fail(new SessionKeyCreationError({ code: "ONCHAIN_PREPARATION_FAILED" })),
        }),
      );

      const policies = input.request.policies.map((policy) =>
        materializeEvmPolicy(policy, Schema.decodeSync(PolicyId)(generateUniqueId())),
      ) satisfies EvmSessionKeyPolicies;
      const policyHash = yield* hashSessionKeyPolicies(crypto, policies);
      const policyTypes = policies.map((policy) => policy.type);
      const effectiveExpiry = policies
        .filter((policy) => policy.type === "evm.time-window")
        .map((policy) => policy.expiresAt)
        .reduce(
          (earliest, expiresAt) =>
            DateTime.toEpochMillis(expiresAt) < DateTime.toEpochMillis(earliest)
              ? expiresAt
              : earliest,
          DateTime.fromEpochSeconds(input.request.onchain.validUntil),
        );

      const sessionKey = yield* transaction.run(
        Effect.gen(function* () {
          const current = yield* repository.core.wallet.findByIdForUpdate(
            wallet.wallet.id,
            input.organizationId,
          );
          if (current === undefined || current.wallet.status !== "active")
            return yield* new SessionKeyCreationError({ code: "WALLET_NOT_ACTIVE" });
          if (
            current.signingKey.id !== wallet.signingKey.id ||
            current.signingKey.status !== "active"
          )
            return yield* new SessionKeyCreationError({ code: "WALLET_OWNER_UNAVAILABLE" });
          if (
            DateTime.toEpochMillis(effectiveExpiry) <= DateTime.toEpochMillis(yield* DateTime.now)
          )
            return yield* new SessionKeyCreationError({ code: "TIME_WINDOW_EXPIRED" });
          const registeredSigner = yield* repository.core.signingKey.insertIfPublicKeyAvailable({
            id: signingKeyId,
            organizationId: input.organizationId,
            purpose: "session",
            custody: "local",
            algorithm: "secp256k1",
            publicKeyHex: signer.publicKey,
            status: "active",
            data: { version: 1, type: "local-key" },
          });
          if (registeredSigner === undefined) {
            return yield* new SessionKeyCreationError({ code: "SIGNER_ALREADY_REGISTERED" });
          }
          const created = yield* repository.core.sessionKey.insert({
            organizationId: input.organizationId,
            walletId: wallet.wallet.id,
            signingKeyId,
            createdByActorId: input.actorId,
            namespace: input.request.namespace,
            metadata: input.request.metadata,
            policies,
            policyHash,
          });
          for (const installation of installations) {
            yield* repository.core.sessionKeyInstallation.insert({
              ...installation,
              organizationId: input.organizationId,
              sessionKeyId: created.id,
              walletId: wallet.wallet.id,
              namespace: "eip155",
              entityId,
            });
          }
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
});
