import type { Hex, WalletKeyId } from "@namera-ai/protocol";
import type { WalletKey } from "@namera-ai/protocol/model";

export type WalletKeyAlgorithmProtection =
  | {
      readonly algorithm: "p256" | "ed25519";
      readonly protectionLevel: "software" | "hsm";
    }
  | {
      readonly algorithm: "secp256k1";
      readonly protectionLevel: "hsm";
    };

export type CreateWalletKeyInput = WalletKeyAlgorithmProtection & {
  readonly id: WalletKeyId;
};

export interface CreatedWalletKey {
  readonly provider: WalletKey["provider"];
  readonly algorithm: WalletKey["algorithm"];
  readonly protectionLevel: WalletKey["protectionLevel"];
  readonly keyVersionName: string;
  readonly publicKeyHex: Hex;
  readonly data: WalletKey["data"];
}

export interface SignWalletKeyInput {
  readonly keyVersionName: string;
  readonly algorithm: WalletKey["algorithm"];
  readonly payload: Uint8Array;
}
