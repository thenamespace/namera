import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import { SignatureError } from "@namera-ai/protocol";
import type {
  GrantedActorData,
  SignRequest,
  VerifySignatureRequest,
} from "@namera-ai/protocol/dto";
import type { EvmSessionKey, SessionKeyGrant } from "@namera-ai/protocol/model";

import { makeLoadEvmAccount } from "#/wallet/account";

export type GrantedEvmSessionKey = {
  readonly grant: SessionKeyGrant;
  readonly sessionKey: EvmSessionKey;
};

type SignatureRequest = SignRequest | VerifySignatureRequest;

export const makeLoadSignatureAccount = Effect.gen(function* () {
  const repository = yield* Repository;
  const loadEvmAccount = yield* makeLoadEvmAccount;

  return Effect.fnUntraced(function* (input: {
    readonly organizationId: GrantedActorData["organizationId"];
    readonly request: SignatureRequest;
  }) {
    const wallet = yield* repository.core.wallet.findById(
      input.request.walletId,
      input.organizationId,
    );
    if (wallet === undefined || wallet.wallet.namespace !== input.request.namespace) {
      return yield* new SignatureError({ code: "SIGNATURE_UNAVAILABLE" });
    }

    const account = yield* loadEvmAccount(wallet).pipe(
      Effect.mapError(() => new SignatureError({ code: "SIGNATURE_UNAVAILABLE" })),
    );
    return { wallet, account } as const;
  });
});

export const getSignatureCandidates = (
  actor: GrantedActorData,
  walletId: SignRequest["walletId"],
): ReadonlyArray<GrantedEvmSessionKey> =>
  actor.grants.filter(
    (item): item is GrantedEvmSessionKey =>
      item.sessionKey.namespace === "eip155" &&
      item.sessionKey.walletId === walletId &&
      item.sessionKey.status === "active" &&
      item.sessionKey.policies.some((policy) => policy.type === "evm.signature"),
  );

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
