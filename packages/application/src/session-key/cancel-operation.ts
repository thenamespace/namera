import { DateTime, Effect } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import {
  SessionKeyOperationError,
  type ActorId,
  type OrganizationId,
  type SessionKeyOperationId,
} from "@namera-ai/protocol";

import { Audit } from "#/audit/layer";
import { makeCheckManagementAuthority } from "#/auth/core/management-authority";

export const makeCancelSessionKeyOperation = Effect.gen(function* () {
  const repository = yield* Repository;
  const checkAuthority = yield* makeCheckManagementAuthority;
  const transaction = yield* TransactionService;
  const audit = yield* Audit;
  return Effect.fn("application.sessionKey.cancelOperation")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId: ActorId;
      readonly operationId: SessionKeyOperationId;
      readonly allowedKinds: ReadonlyArray<"install" | "uninstall">;
    }) {
      return yield* transaction.run(
        Effect.gen(function* () {
          const scope = { id: input.operationId, organizationId: input.organizationId };
          const operation = yield* repository.core.sessionKeyOperation.findById(scope);
          if (
            !operation ||
            operation.actorId !== input.actorId ||
            !input.allowedKinds.includes(operation.kind)
          )
            return yield* new SessionKeyOperationError({ code: "OPERATION_UNAVAILABLE" });
          if (
            !(yield* checkAuthority({
              ...input,
              permission:
                operation.kind === "install" ? "session-key:install" : "session-key:uninstall",
            }))
          )
            return yield* new SessionKeyOperationError({ code: "OPERATION_UNAVAILABLE" });
          yield* repository.core.wallet.findByIdForUpdate(operation.walletId, input.organizationId);
          const current = yield* repository.core.sessionKeyOperation.findById(scope);
          if (current?.status === "cancelled")
            return { operationId: current.id, status: current.status };
          const cancelled = yield* repository.core.sessionKeyOperation.cancelUnsigned({
            ...scope,
            actorId: input.actorId,
            now: yield* DateTime.now,
          });
          if (!cancelled)
            return yield* new SessionKeyOperationError({ code: "OPERATION_UNAVAILABLE" });
          const installation = yield* repository.core.sessionKeyInstallation.findById({
            id: operation.installationId,
            organizationId: input.organizationId,
          });
          if (!installation)
            return yield* Effect.die("Cancelled operation installation is missing");
          // No holds exist before approval; do not change session/grant authority.
          yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "session_key.operation_cancelled",
            resourceType: "session-key",
            resourceId: installation.sessionKeyId,
            data: {
              version: 1,
              installationId: installation.id,
              operationId: operation.id,
              chainId: operation.chainId,
              kind: operation.kind,
            },
          });
          return { operationId: cancelled.id, status: cancelled.status };
        }),
      );
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
