import { DateTime, Effect } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { SignatureError, type SignatureOperationId } from "@namera-ai/protocol";
import type { GrantedActorData } from "@namera-ai/protocol/dto";

import { Audit } from "#/audit/layer";
import { makeBillingMetering } from "#/billing/index";

export const makeSignatureOperationLifecycle = Effect.gen(function* () {
  const audit = yield* Audit;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const billing = yield* makeBillingMetering;

  const findBillingReservation = Effect.fnUntraced(function* (
    organizationId: GrantedActorData["organizationId"],
    operationId: SignatureOperationId,
  ) {
    const reservations = yield* repository.billing.usageReservation.listBySource(
      organizationId,
      "signature-operation",
      operationId,
    );
    return reservations.find((reservation) => reservation.meterKey === "signature");
  });

  const succeed = Effect.fn("application.signature.succeedOperation")(function* (input: {
    readonly actor: GrantedActorData;
    readonly operationId: SignatureOperationId;
    readonly leaseToken?: string;
  }) {
    return yield* transaction.run(
      Effect.gen(function* () {
        const operation = yield* repository.core.signatureOperation.findByIdForUpdate(
          input.operationId,
          input.actor.organizationId,
        );
        if (operation === undefined || operation.actorId !== input.actor.actorId)
          return yield* new SignatureError({ code: "SIGNATURE_UNAVAILABLE" });
        if (operation.status === "succeeded" && input.leaseToken === undefined) return false;
        if (
          operation.status !== "reserved" ||
          (input.leaseToken !== undefined &&
            (operation.leaseToken !== input.leaseToken ||
              operation.leaseExpiresAt === null ||
              DateTime.toEpochMillis(operation.leaseExpiresAt) <=
                DateTime.toEpochMillis(yield* DateTime.now))) ||
          DateTime.toEpochMillis(operation.reservationExpiresAt) <=
            DateTime.toEpochMillis(yield* DateTime.now)
        )
          return yield* new SignatureError({ code: "SIGNATURE_UNAVAILABLE" });

        const reservation = yield* findBillingReservation(input.actor.organizationId, operation.id);
        if (reservation === undefined)
          return yield* Effect.die("Signature billing reservation is missing");
        yield* billing.settle({
          organizationId: input.actor.organizationId,
          reservationId: reservation.id,
          amount: 1n,
          data: {
            version: 1,
            namespace: "eip155",
            chainId: operation.data.chainId,
            type: operation.data.type,
          },
        });

        const succeeded = yield* repository.core.signatureOperation.markSucceeded({
          id: operation.id,
          organizationId: operation.organizationId,
          succeededAt: yield* DateTime.now,
          ...(input.leaseToken === undefined ? {} : { leaseToken: input.leaseToken }),
        });
        if (succeeded === undefined) {
          return yield* Effect.die("Signature operation could not be completed");
        }

        yield* audit.organization({
          organizationId: input.actor.organizationId,
          actorId: input.actor.actorId,
          event: "signature.created",
          resourceType: "wallet",
          resourceId: operation.walletId,
          data: {
            version: 1,
            namespace: "eip155",
            chainId: operation.data.chainId,
            type: operation.data.type,
            sessionKeyGrantId: operation.sessionKeyGrantId,
          },
        });
        return true;
      }),
    );
  });

  return { succeed } as const;
});
