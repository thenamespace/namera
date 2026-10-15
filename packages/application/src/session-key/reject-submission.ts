import { DateTime, Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import type { SessionKeyOperation } from "@namera-ai/protocol/model";
import { sessionKeyOperationResults } from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";
import { makeBillingMetering } from "#/billing/metering";

import { makeFinishSessionKeyRevocation } from "./finish-revocation.js";

/** Only the worker that recorded the first send may supply definitive rejection evidence. */
export const makeRejectSessionKeySubmission = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const billing = yield* makeBillingMetering;
  const audit = yield* Audit;
  const finishRevocation = yield* makeFinishSessionKeyRevocation;

  return Effect.fn("application.sessionKey.rejectSubmission")(function* (
    operation: SessionKeyOperation,
    leaseToken: string,
  ) {
    const rejected = yield* transaction.run(
      Effect.gen(function* () {
        yield* repository.core.wallet.findByIdForUpdate(
          operation.walletId,
          operation.organizationId,
        );
        const finished = yield* repository.core.sessionKeyOperation.rejectSubmission({
          id: operation.id,
          organizationId: operation.organizationId,
          leaseToken,
          now: yield* DateTime.now,
        });
        if (!finished) return false;
        const installation = yield* repository.core.sessionKeyInstallation.findById({
          id: operation.installationId,
          organizationId: operation.organizationId,
        });
        if (!installation) return yield* Effect.die("Rejected operation installation is missing");
        const reservations = yield* repository.billing.usageReservation.listBySource(
          operation.organizationId,
          "session-key-operation",
          operation.id,
        );
        for (const reservation of reservations) {
          yield* billing.release({
            organizationId: operation.organizationId,
            reservationId: reservation.id,
          });
        }
        // No inclusion occurred: retain the prior installation state and revoked API grants.
        yield* audit.organization(
          {
            organizationId: operation.organizationId,
            actorId: operation.actorId,
            event: "session_key.operation_failed",
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
          { organizationId: operation.organizationId, sessionKeyId: installation.sessionKeyId },
          { source: "system" },
        );
        return true;
      }),
    );
    if (rejected)
      yield* Metric.update(
        Metric.withAttributes(sessionKeyOperationResults, {
          stage: "reconcile",
          result: "failed",
        }),
        1,
      );
  });
});
