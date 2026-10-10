import { Effect } from "effect";

import type { WalletView } from "@namera-ai/database";
import { createPublicKeyWebAuthnAccount, createSecp256k1OwnerAccount } from "@namera-ai/evm";
import { SessionKeyOperationError } from "@namera-ai/protocol";

import { AuthConfig } from "#/auth/config";

/** Public reconstruction only; session use must never load a managed root credential. */
export const makeLoadPublicSessionOwner = Effect.gen(function* () {
  const config = yield* AuthConfig;
  return Effect.fnUntraced(function* (view: WalletView) {
    const { wallet, signingKey: key } = view;
    if (
      wallet.status !== "active" ||
      key.status !== "active" ||
      wallet.signingKeyId !== key.id ||
      wallet.organizationId !== key.organizationId ||
      key.purpose !== "wallet-root"
    )
      return yield* new SessionKeyOperationError({ code: "OWNER_UNAVAILABLE" });

    if (
      wallet.data.validatorType === "webauthn_p256" &&
      key.custody === "local" &&
      key.data.type === "passkey" &&
      key.data.rpId === config.dashboardPublicOrigin.hostname
    ) {
      return {
        type: "passkey" as const,
        credential: key.data,
        account: {
          wallet: wallet.data,
          owner: {
            validatorType: "webauthn_p256" as const,
            account: createPublicKeyWebAuthnAccount(key.publicKeyHex),
          },
        },
      };
    }
    if (
      wallet.data.validatorType === "ecdsa_secp256k1" &&
      wallet.data.accountMode === "factory" &&
      key.custody === "namera-managed" &&
      key.algorithm === "secp256k1" &&
      key.data.type === "1claw" &&
      key.data.chain === "ethereum" &&
      key.providerConnectionId !== null
    ) {
      const account = createSecp256k1OwnerAccount({
        publicKey: key.publicKeyHex,
        sign: async () => {
          throw new Error("Public owner cannot sign");
        },
      });
      if (account.address.toLowerCase() !== wallet.data.ownerAddress.toLowerCase())
        return yield* new SessionKeyOperationError({ code: "OWNER_UNAVAILABLE" });
      return {
        type: "1claw" as const,
        account: {
          wallet: wallet.data,
          owner: { validatorType: "ecdsa_secp256k1" as const, account },
        },
      };
    }
    return yield* new SessionKeyOperationError({ code: "OWNER_UNAVAILABLE" });
  });
});
