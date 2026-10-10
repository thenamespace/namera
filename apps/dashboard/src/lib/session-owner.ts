import type { WalletResponse } from "@namera-ai/protocol/dto";

export function isOneClawAccount(wallet: WalletResponse) {
  return (
    wallet.owner.custody === "namera-managed" &&
    wallet.owner.provider === "1claw" &&
    wallet.owner.algorithm === "secp256k1" &&
    wallet.data.validatorType === "ecdsa_secp256k1" &&
    wallet.data.accountMode === "factory"
  );
}

export function supportsSessionKeys(wallet: WalletResponse) {
  return (
    wallet.status === "active" &&
    (isOneClawAccount(wallet) ||
      (wallet.owner.custody === "local" &&
        wallet.owner.algorithm === "p256" &&
        wallet.data.validatorType === "webauthn_p256"))
  );
}
