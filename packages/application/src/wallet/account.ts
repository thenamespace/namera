import { Data, Effect, Schema } from "effect";

import type { WalletView } from "@namera-ai/database";
import { createWalletKeySecp256k1Account, createWalletKeyWebAuthnAccount } from "@namera-ai/evm";
import {
  GcpSigningKeyData,
  ManagedLocalSigningKeyData,
  WalletKeyHash,
} from "@namera-ai/protocol/model";
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
      wallet.signingKey.status !== "active" ||
      wallet.signingKey.custody !== "namera-managed" ||
      wallet.signingKey.data.type === "1claw"
    ) {
      return yield* new WalletAccountUnavailable();
    }

    const signer =
      wallet.signingKey.data.type === "gcp-kms"
        ? (() => {
            const managedKey = Schema.decodeUnknownSync(GcpSigningKeyData)(wallet.signingKey.data);
            return {
              provider: "gcp-kms" as const,
              algorithm: wallet.signingKey.algorithm,
              data: {
                version: 1 as const,
                providerAlgorithm: managedKey.providerAlgorithm,
                keyVersionName: managedKey.keyVersionName,
              },
            };
          })()
        : (() => {
            const managedKey = Schema.decodeUnknownSync(ManagedLocalSigningKeyData)(
              wallet.signingKey.data,
            );
            return {
              provider: "local" as const,
              algorithm: wallet.signingKey.algorithm,
              data: { version: 1 as const, fileName: managedKey.fileName },
            };
          })();
    if (wallet.wallet.data.validatorType === "webauthn_p256") {
      if (wallet.signingKey.algorithm !== "p256") {
        return yield* new WalletAccountUnavailable();
      }

      const owner = createWalletKeyWebAuthnAccount({
        id: wallet.signingKey.id,
        publicKey: wallet.signingKey.publicKeyHex,
        origin: authConfig.dashboardPublicOrigin.origin,
        rpId: authConfig.dashboardPublicOrigin.hostname,
        validatorType: "webauthn_p256",
        sign: (payload) =>
          Effect.runPromise(walletKeys.signMessage({ ...signer, message: payload })),
      });

      return {
        wallet: wallet.wallet.data,
        owner: { validatorType: "webauthn_p256", account: owner },
      } as const;
    }

    if (wallet.signingKey.algorithm !== "secp256k1") {
      return yield* new WalletAccountUnavailable();
    }

    const owner = createWalletKeySecp256k1Account({
      publicKey: wallet.signingKey.publicKeyHex,
      sign: (hash) =>
        Effect.runPromise(
          walletKeys.signHash({
            ...signer,
            algorithm: "secp256k1",
            hash: Schema.decodeSync(WalletKeyHash)(hash),
          }),
        ),
    });

    return {
      wallet: wallet.wallet.data,
      owner: { validatorType: "ecdsa_secp256k1", account: owner },
    } as const;
  });
});
