import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import { createPublicKeyWebAuthnAccount } from "@namera-ai/evm";
import { SignatureError } from "@namera-ai/protocol";
import type { GrantedActorData, VerifySignatureRequest } from "@namera-ai/protocol/dto";

export const makeLoadSignatureAccount = Effect.gen(function* () {
  const repository = yield* Repository;

  return Effect.fnUntraced(function* (input: {
    readonly organizationId: GrantedActorData["organizationId"];
    readonly request: VerifySignatureRequest;
  }) {
    const wallet = yield* repository.core.wallet.findById(
      input.request.walletId,
      input.organizationId,
    );
    if (
      wallet === undefined ||
      wallet.wallet.namespace !== input.request.namespace ||
      wallet.wallet.status !== "active" ||
      wallet.signingKey.status !== "active" ||
      wallet.signingKey.custody !== "local" ||
      wallet.signingKey.data.type !== "passkey" ||
      wallet.wallet.data.validatorType !== "webauthn_p256"
    ) {
      return yield* new SignatureError({ code: "SIGNATURE_UNAVAILABLE" });
    }

    const account = {
      wallet: wallet.wallet.data,
      owner: {
        validatorType: "webauthn_p256" as const,
        account: createPublicKeyWebAuthnAccount(wallet.signingKey.publicKeyHex),
      },
    };
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
