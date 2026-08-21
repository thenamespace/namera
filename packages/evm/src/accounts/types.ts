import type { AlchemyModularV2WalletData } from "@namera-ai/protocol/model";
import type { WebAuthnAccount } from "viem/account-abstraction";

export type ReconstructEvmAccountInput = {
  readonly wallet: AlchemyModularV2WalletData;
  readonly owner: WebAuthnAccount;
};
