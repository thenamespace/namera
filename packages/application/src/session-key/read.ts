import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import {
  SessionKeyNotFoundError,
  WalletNotFoundError,
  type ActorId,
  type OrganizationId,
  type SessionKeyId,
  type WalletId,
} from "@namera-ai/protocol";

import { makeLoadSessionKeyViews } from "./view.js";

export const makeReadSessionKeys = Effect.gen(function* () {
  const repository = yield* Repository;
  const loadViews = yield* makeLoadSessionKeyViews;

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

  return { get, listForOrganization, listForWallet };
});
