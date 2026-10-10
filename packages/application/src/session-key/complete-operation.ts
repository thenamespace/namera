import { DateTime, Duration, Effect, Metric, Result } from "effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as HexEncoding from "effect/encoding/Hex";

import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { Passkeys } from "@namera-ai/passkeys";
import { SessionKeyOperationError, type ActorId, type OrganizationId } from "@namera-ai/protocol";
import type {
  CompleteSessionKeyOperationRequest,
  ApproveManagedSessionKeyOperationRequest,
} from "@namera-ai/protocol/dto";
import { sessionKeyOperationResults, sessionKeyOperationDuration } from "@namera-ai/telemetry";
import { generateUniqueId } from "@namera-ai/utils";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";
import { makeBillingMetering } from "#/billing/metering";

import { makeManagedSessionApproval } from "./managed-approval.js";
import { makeLoadSessionOperationOwner } from "./operation-owner.js";

export const makeCompleteSessionKeyOperations = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const evm = yield* Evm;
  const passkeys = yield* Passkeys;
  const config = yield* AuthConfig;
  const audit = yield* Audit;
  const billing = yield* makeBillingMetering;
  const loadOwner = yield* makeLoadSessionOperationOwner;
  const managed = yield* makeManagedSessionApproval;

  const complete = Effect.fn("application.sessionKey.completeOperation")(
    function* (
      input: {
        readonly organizationId: OrganizationId;
        readonly actorId: ActorId;
        readonly allowedKinds: ReadonlyArray<"install" | "uninstall">;
        readonly request:
          | CompleteSessionKeyOperationRequest
          | ApproveManagedSessionKeyOperationRequest;
      },
      approval: "passkey" | "1claw",
    ) {
      const scope = { id: input.request.operationId, organizationId: input.organizationId };
      const operation = yield* repository.core.sessionKeyOperation.findById(scope);
      if (
        operation === undefined ||
        operation.actorId !== input.actorId ||
        !input.allowedKinds.includes(operation.kind)
      )
        return yield* new SessionKeyOperationError({ code: "OPERATION_UNAVAILABLE" });
      // A retry can observe a durable accepted attempt without consuming the passkey twice.
      if (["signed", "submitted", "confirmed", "failed"].includes(operation.status))
        return { operationId: operation.id, status: operation.status };
      if (
        operation.status === "expired" ||
        DateTime.toEpochMillis(operation.expiresAt) <= DateTime.toEpochMillis(yield* DateTime.now)
      )
        return yield* new SessionKeyOperationError({ code: "APPROVAL_EXPIRED" });
      const owner = yield* loadOwner({
        organizationId: input.organizationId,
        installationId: operation.installationId,
      });
      if (owner.type !== approval)
        return yield* new SessionKeyOperationError({ code: "OWNER_UNAVAILABLE" });
      const result = yield* Effect.gen(function* () {
        if (approval === "1claw") {
          const managedSignature = yield* managed.sign(operation);
          return { ...managedSignature, assertion: undefined, credential: undefined };
        }
        if (owner.type !== "passkey" || !("response" in input.request))
          return yield* new SessionKeyOperationError({ code: "APPROVAL_INVALID" });
        const challenge = yield* evm.execution
          .ownerApprovalChallenge({ account: owner.account, prepared: operation.data.prepared })
          .pipe(
            Effect.mapError(
              (error) =>
                new SessionKeyOperationError({
                  code:
                    "code" in error && error.code === "NETWORK_PAUSED"
                      ? "NETWORK_PAUSED"
                      : "APPROVAL_INVALID",
                }),
            ),
          );
        const assertion = yield* passkeys
          .verifyAuthentication({
            response: input.request.response,
            expectedChallenge: Base64Url.encode(
              Result.getOrThrow(HexEncoding.decode(challenge.slice(2))),
            ),
            expectedOrigin: config.dashboardPublicOrigin.origin,
            expectedRpId: owner.credential.rpId,
            credentialId: owner.credential.credentialId,
            publicKeyHex: owner.wallet.signingKey.publicKeyHex,
            signCount: owner.credential.signCount,
          })
          .pipe(Effect.mapError(() => new SessionKeyOperationError({ code: "APPROVAL_INVALID" })));
        const signed = yield* evm.execution
          .completeOwnerApproval({
            account: owner.account,
            prepared: operation.data.prepared,
            assertion,
          })
          .pipe(
            Effect.mapError(
              (error) =>
                new SessionKeyOperationError({
                  code:
                    "code" in error && error.code === "NETWORK_PAUSED"
                      ? "NETWORK_PAUSED"
                      : "APPROVAL_INVALID",
                }),
            ),
          );
        return { signed, assertion, credential: owner.credential, leaseToken: undefined };
      });
      const { signed } = result;

      const persistedOperation = yield* transaction.run(
        Effect.gen(function* () {
          const wallet = yield* repository.core.wallet.findByIdForUpdate(
            operation.walletId,
            input.organizationId,
          );
          if (
            wallet === undefined ||
            wallet.signingKey.id !== owner.wallet.signingKey.id ||
            wallet.signingKey.publicKeyHex !== owner.wallet.signingKey.publicKeyHex
          )
            return yield* new SessionKeyOperationError({ code: "OWNER_UNAVAILABLE" });
          const existing = yield* repository.core.sessionKeyOperation.findById(scope);
          if (
            existing !== undefined &&
            ["signed", "submitted", "confirmed", "failed"].includes(existing.status)
          )
            return existing;
          const current = yield* loadOwner({
            organizationId: input.organizationId,
            installationId: operation.installationId,
          });
          if (
            operation.kind === "install" &&
            (!["pending", "active"].includes(current.session.status) ||
              !["pending", "failed"].includes(current.installation.status) ||
              current.installation.data.authorization.validUntil <=
                DateTime.toEpochSeconds(yield* DateTime.now))
          )
            return yield* new SessionKeyOperationError({ code: "INVALID_TRANSITION" });
          if (
            operation.kind === "uninstall" &&
            (current.session.status !== "revoking" ||
              !["installed", "revoking"].includes(current.installation.status))
          )
            return yield* new SessionKeyOperationError({ code: "INVALID_TRANSITION" });
          if (result.assertion !== undefined && result.credential !== undefined) {
            const counter = yield* repository.core.signingKey.advancePasskeyCounter({
              id: wallet.signingKey.id,
              organizationId: input.organizationId,
              credentialId: result.credential.credentialId,
              expectedCounter: result.credential.signCount,
              nextCounter: result.assertion.signCount,
            });
            if (counter === undefined)
              return yield* new SessionKeyOperationError({ code: "APPROVAL_INVALID" });
          } else {
            yield* managed.check(operation).pipe(Effect.catchTag("ConfigError", Effect.die));
          }
          const now = yield* DateTime.now;
          const accepted = yield* repository.core.sessionKeyOperation.acceptSignature({
            ...scope,
            actorId: input.actorId,
            requestHash: operation.requestHash,
            signed,
            now,
            leaseToken: generateUniqueId(),
            leaseExpiresAt: DateTime.addDuration(now, Duration.seconds(1)),
            ...(result.leaseToken === undefined ? {} : { signingLeaseToken: result.leaseToken }),
          });
          if (accepted === undefined)
            return yield* new SessionKeyOperationError({ code: "APPROVAL_EXPIRED" });
          if (operation.kind === "uninstall")
            yield* repository.core.sessionKeyInstallation.beginRevocation({
              id: current.installation.id,
              organizationId: input.organizationId,
            });
          const billingSource = {
            organizationId: input.organizationId,
            sourceType: "session-key-operation" as const,
            sourceId: operation.id,
            expiresAt: DateTime.addDuration(now, Duration.hours(24)),
          };
          yield* billing.reserve({
            ...billingSource,
            meterKey: signed.billing.executionMeter,
            amount: 1n,
          });
          if (
            signed.billing.sponsorship !== null &&
            signed.billing.sponsorship.reservationAmountMicroUsd > 0n
          )
            yield* billing.reserve({
              ...billingSource,
              meterKey: "gas-sponsorship",
              amount: signed.billing.sponsorship.reservationAmountMicroUsd,
            });
          yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "session_key.operation_approved",
            resourceType: "session-key",
            resourceId: current.session.id,
            data: {
              version: 1,
              installationId: current.installation.id,
              operationId: operation.id,
              chainId: operation.chainId,
              kind: operation.kind,
            },
          });
          yield* Metric.update(
            Metric.withAttributes(sessionKeyOperationResults, {
              stage: "approve",
              result: "signed",
            }),
            1,
          );
          return accepted;
        }),
      );
      // Broadcasting belongs to the durable receipt worker. Never discard this
      // signature or its billing hold merely because the HTTP request ended.
      return { operationId: persistedOperation.id, status: persistedOperation.status };
    },
    Effect.scoped,
    Effect.trackDuration(Metric.withAttributes(sessionKeyOperationDuration, { stage: "approve" })),
    Effect.tapErrorTag("SessionKeyOperationError", (error) =>
      Metric.update(
        Metric.withAttributes(sessionKeyOperationResults, { stage: "approve", result: error.code }),
        1,
      ),
    ),
    Effect.catchTag("DatabaseError", Effect.die),
  );
  type Input = Omit<Parameters<typeof complete>[0], "request">;
  return {
    completeOperation: (input: Input & { readonly request: CompleteSessionKeyOperationRequest }) =>
      complete(input, "passkey"),
    approveManagedOperation: (
      input: Input & { readonly request: ApproveManagedSessionKeyOperationRequest },
    ) => complete(input, "1claw"),
  };
});
