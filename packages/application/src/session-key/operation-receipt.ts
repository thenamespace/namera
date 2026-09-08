import { DateTime, Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { Evm, isReceiptForEvmExecution } from "@namera-ai/evm";
import { SessionKeyOperationError, type EvmExecutionReceipt } from "@namera-ai/protocol";
import type { SessionKeyOperation } from "@namera-ai/protocol/model";
import { sessionKeyOperationResults } from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";
import { makeBillingMetering } from "#/billing/metering";

import { makeFinishSessionKeyRevocation } from "./finish-revocation.js";

export const makeSettleSessionKeyOperation = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const evm = yield* Evm;
  const billing = yield* makeBillingMetering;
  const audit = yield* Audit;
  const finishRevocation = yield* makeFinishSessionKeyRevocation;

  return Effect.fn("application.sessionKey.settleOperation")(function* (
    operation: SessionKeyOperation,
    leaseToken: string,
    receipt: EvmExecutionReceipt,
  ) {
    const signed = operation.data.signed;
    if (signed === null || !isReceiptForEvmExecution(signed, receipt))
      return yield* new SessionKeyOperationError({ code: "INVALID_TRANSITION" });

    const settled = yield* transaction.run(
      Effect.gen(function* () {
        // Serialize owner transitions with preparation and passkey consumption.
        const wallet = yield* repository.core.wallet.findByIdForUpdate(
          operation.walletId,
          operation.organizationId,
        );
        if (wallet === undefined)
          return yield* new SessionKeyOperationError({ code: "OWNER_UNAVAILABLE" });
        const now = yield* DateTime.now;
        const finished = yield* repository.core.sessionKeyOperation.finishReceipt({
          id: operation.id,
          organizationId: operation.organizationId,
          leaseToken,
          now,
          userOperationHash: receipt.userOperationHash,
          transactionHash: receipt.transactionHash,
          success: receipt.success,
        });
        if (finished === undefined) return false;
        const scope = { id: operation.installationId, organizationId: operation.organizationId };
        const confirmation = {
          ...scope,
          userOperationHash: receipt.userOperationHash,
          transactionHash: receipt.transactionHash,
          confirmedAt: now,
        };
        if (operation.kind === "install") {
          yield* repository.core.sessionKeyInstallation.markSubmitted(confirmation);
        } else {
          yield* repository.core.sessionKeyInstallation.beginRevocation(scope);
          yield* repository.core.sessionKeyInstallation.markRevocationSubmitted(confirmation);
        }
        const installation = yield* receipt.success
          ? operation.kind === "install"
            ? repository.core.sessionKeyInstallation.markInstalled(confirmation)
            : repository.core.sessionKeyInstallation.markRevoked(confirmation)
          : repository.core.sessionKeyInstallation.markFailed({
              ...confirmation,
              kind: operation.kind,
            });
        if (installation === undefined)
          return yield* new SessionKeyOperationError({ code: "INVALID_TRANSITION" });
        if (receipt.success && operation.kind === "install") {
          yield* repository.core.sessionKey.activate(
            installation.sessionKeyId,
            operation.organizationId,
          );
        }
        const reservations = yield* repository.billing.usageReservation.listBySource(
          operation.organizationId,
          "session-key-operation",
          operation.id,
        );
        for (const reservation of reservations) {
          // Included failures still consume a UserOperation and actual sponsored gas.
          yield* billing.settle({
            organizationId: operation.organizationId,
            reservationId: reservation.id,
            amount:
              reservation.meterKey === "gas-sponsorship"
                ? evm.billing.settleGasSponsorship({ billing: signed.billing, receipt })
                : 1n,
            data: {
              version: 1,
              namespace: "eip155",
              chainId: receipt.chainId,
              transactionHash: receipt.transactionHash,
              actualGasCostWei: receipt.actualGasCost.toString(),
            },
          });
        }
        yield* audit.organization(
          {
            organizationId: operation.organizationId,
            actorId: operation.actorId,
            event: receipt.success
              ? "session_key.operation_confirmed"
              : "session_key.operation_failed",
            resourceType: "session-key",
            resourceId: installation.sessionKeyId,
            data: {
              version: 1,
              installationId: installation.id,
              operationId: operation.id,
              chainId: operation.chainId,
              kind: operation.kind,
            },
          },
          { source: "system" },
        );
        yield* finishRevocation(
          {
            organizationId: operation.organizationId,
            sessionKeyId: installation.sessionKeyId,
          },
          { source: "system" },
        );
        return true;
      }),
    );
    if (settled)
      yield* Metric.update(
        Metric.withAttributes(sessionKeyOperationResults, {
          stage: "reconcile",
          result: receipt.success ? "confirmed" : "failed",
        }),
        1,
      );
    return settled;
  });
});
