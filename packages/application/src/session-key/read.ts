import { DateTime, Effect } from "effect";

import { Repository } from "@namera-ai/database";
import {
  SessionKeyNotFoundError,
  SessionKeyOperationError,
  WalletNotFoundError,
  type ActorId,
  type OrganizationId,
  type SessionKeyId,
  type SessionKeyOperationId,
  type WalletId,
} from "@namera-ai/protocol";
import type {
  GetActiveSessionKeyOperationRequest,
  GetActiveSessionKeyOperationResponse,
} from "@namera-ai/protocol/dto";

import { makeLoadSessionKeyViews } from "./view.js";

export const makeReadSessionKeys = Effect.gen(function* () {
  const repository = yield* Repository;
  const loadViews = yield* makeLoadSessionKeyViews;

  const getActiveOperation = Effect.fn("application.sessionKey.getActiveOperation")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId: ActorId;
      readonly request: GetActiveSessionKeyOperationRequest;
    }) {
      const installation = yield* repository.core.sessionKeyInstallation.findById({
        organizationId: input.organizationId,
        id: input.request.installationId,
      });
      if (installation === undefined)
        return yield* new SessionKeyOperationError({ code: "INSTALLATION_UNAVAILABLE" });
      const operation = yield* repository.core.sessionKeyOperation.findActiveForInstallation({
        organizationId: input.organizationId,
        ...input.request,
      });
      if (operation === undefined) return { operation: null };
      const now = yield* DateTime.now;
      return {
        operation: {
          operationId: operation.id,
          status: operation.status,
          retryRequest:
            operation.actorId === input.actorId &&
            operation.status === "awaiting-signature" &&
            DateTime.toEpochMillis(operation.expiresAt) > DateTime.toEpochMillis(now)
              ? {
                  installationId: operation.installationId,
                  kind: operation.kind,
                  idempotencyKey: operation.idempotencyKey,
                  sponsor: operation.data.prepared.sponsorship === "alchemy-bso",
                }
              : null,
        },
      } satisfies GetActiveSessionKeyOperationResponse;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const getOperation = Effect.fn("application.sessionKey.getOperation")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly operationId: SessionKeyOperationId;
    }) {
      const operation = yield* repository.core.sessionKeyOperation.findById({
        id: input.operationId,
        organizationId: input.organizationId,
      });
      if (operation === undefined)
        return yield* new SessionKeyOperationError({ code: "OPERATION_UNAVAILABLE" });
      // The stored envelope includes signatures and leases; expose only polling state.
      return { operationId: operation.id, status: operation.status };
    },
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

  return { get, getOperation, getActiveOperation, listForOrganization, listForWallet };
});
