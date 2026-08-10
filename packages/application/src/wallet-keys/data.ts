import type { Hex, WalletKeyId } from "@namera-ai/protocol";
import type { WalletKey } from "@namera-ai/protocol/model";

export interface CreateWalletKeyInput {
  readonly id: WalletKeyId;
  readonly protectionLevel: WalletKey["protectionLevel"];
}

export interface CreatedWalletKey {
  readonly provider: WalletKey["provider"];
  readonly algorithm: "p256";
  readonly protectionLevel: WalletKey["protectionLevel"];
  readonly keyVersionName: string;
  readonly publicKeyHex: Hex;
  readonly data: WalletKey["data"];
}

export interface SignWalletKeyInput {
  readonly keyVersionName: string;
  readonly payload: Uint8Array;
}
