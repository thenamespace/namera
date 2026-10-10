import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import { SignatureError } from "@namera-ai/protocol";
import type { GrantedActorData, VerifySignatureRequest } from "@namera-ai/protocol/dto";

import { makeLoadPublicSessionOwner } from "#/wallet/public-owner";

export const makeLoadSignatureAccount = Effect.gen(function* () {
  const repository = yield* Repository;
  const loadPublicOwner = yield* makeLoadPublicSessionOwner;

  return Effect.fnUntraced(function* (input: {
    readonly organizationId: GrantedActorData["organizationId"];
    readonly request: VerifySignatureRequest;
  }) {
    const wallet = yield* repository.core.wallet.findById(
      input.request.walletId,
      input.organizationId,
    );
    if (wallet === undefined || wallet.wallet.namespace !== input.request.namespace) {
      return yield* new SignatureError({ code: "SIGNATURE_UNAVAILABLE" });
    }

    const { account } = yield* loadPublicOwner(wallet).pipe(
      Effect.catchTag("SessionKeyOperationError", () =>
        Effect.fail(new SignatureError({ code: "SIGNATURE_UNAVAILABLE" })),
      ),
    );
    return { wallet, account } as const;
  });
});

export const hasActiveWalletGrant = (
  actor: GrantedActorData,
  walletId: VerifySignatureRequest["walletId"],
): boolean =>
  actor.grants.some(
    ({ sessionKey }) =>
      sessionKey.namespace === "eip155" &&
      sessionKey.walletId === walletId &&
      sessionKey.status === "active",
  );
