import { DateTime, Effect } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import type { SignatureOperationId } from "@namera-ai/protocol";
import type { GrantedActorData } from "@namera-ai/protocol/dto";

import { Audit } from "#/audit/layer";

export const makeSignatureOperationLifecycle = Effect.gen(function* () {
  const audit = yield* Audit;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;

  const fail = Effect.fn("application.signature.failOperation")(function* (input: {
    readonly organizationId: GrantedActorData["organizationId"];
    readonly operationId: SignatureOperationId;
  }) {
    yield* transaction.run(
      Effect.gen(function* () {
        const operation = yield* repository.core.signatureOperation.findByIdForUpdate(
          input.operationId,
          input.organizationId,
        );
        if (operation === undefined || operation.status !== "reserved") return;

        yield* repository.core.signatureOperation.markFailed({
          id: operation.id,
          organizationId: operation.organizationId,
          failureCode: "SIGNING_FAILED",
          failedAt: yield* DateTime.now,
        });
      }),
    );
  });

  const succeed = Effect.fn("application.signature.succeedOperation")(function* (input: {
    readonly actor: GrantedActorData;
    readonly operationId: SignatureOperationId;
  }) {
    yield* transaction.run(
      Effect.gen(function* () {
        const operation = yield* repository.core.signatureOperation.findByIdForUpdate(
          input.operationId,
          input.actor.organizationId,
        );
        if (operation === undefined || operation.status !== "reserved") {
          return yield* Effect.die("Signature operation reservation is missing");
        }

        const succeeded = yield* repository.core.signatureOperation.markSucceeded({
          id: operation.id,
          organizationId: operation.organizationId,
          succeededAt: yield* DateTime.now,
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
      }),
    );
  });

  return { fail, succeed } as const;
});
