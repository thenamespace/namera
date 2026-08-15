import { Data, Effect, Schema } from "effect";

import type { WalletView } from "@namera-ai/database";
import { createWalletKeyWebAuthnAccount } from "@namera-ai/evm";
import { GcpWalletKeyData, LocalWalletKeyData } from "@namera-ai/protocol/model";
import { WalletKeys } from "@namera-ai/wallet-keys";

import { AuthConfig } from "#/auth/config";

export class WalletAccountUnavailable extends Data.TaggedError("WalletAccountUnavailable")<{}> {}

export const makeLoadEvmAccount = Effect.gen(function* () {
  const authConfig = yield* AuthConfig;
  const walletKeys = yield* WalletKeys;

  return Effect.fnUntraced(function* (wallet: WalletView) {
    if (
      wallet.wallet.namespace !== "eip155" ||
      wallet.wallet.status !== "active" ||
      wallet.walletKey.status !== "active"
    ) {
      return yield* new WalletAccountUnavailable();
    }

    const signer =
      wallet.walletKey.provider === "local"
        ? {
            provider: "local" as const,
            algorithm: wallet.walletKey.algorithm,
            data: Schema.decodeUnknownSync(LocalWalletKeyData)(wallet.walletKey.data),
          }
        : {
            provider: "gcp-kms" as const,
            algorithm: wallet.walletKey.algorithm,
            data: Schema.decodeUnknownSync(GcpWalletKeyData)(wallet.walletKey.data),
          };
    const owner = createWalletKeyWebAuthnAccount({
      id: wallet.walletKey.id,
      publicKey: wallet.walletKey.publicKeyHex,
      origin: authConfig.dashboardPublicOrigin.origin,
      rpId: authConfig.dashboardPublicOrigin.hostname,
      validatorType: "webauthn_p256",
      sign: (payload) => Effect.runPromise(walletKeys.signMessage({ ...signer, message: payload })),
    });

    return { wallet: wallet.wallet.data, owner } as const;
  });
});
