import type { KernelWalletData, SafeWalletData } from "@namera-ai/protocol/model";
import type { LocalAccount } from "viem";
import type { WebAuthnAccount } from "viem/account-abstraction";

export type ReconstructEvmAccountInput = {
  readonly wallet: KernelWalletData | SafeWalletData;
  readonly owner: WebAuthnAccount | LocalAccount;
};
