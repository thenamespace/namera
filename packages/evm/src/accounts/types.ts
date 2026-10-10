import type { AlchemyModularV2WalletData } from "@namera-ai/protocol/model";
import type { Hex, LocalAccount } from "viem";
import type { WebAuthnAccount } from "viem/account-abstraction";

export type AlchemyModularV2Owner =
  | {
      readonly validatorType: "webauthn_p256";
      readonly account: WebAuthnAccount;
    }
  | {
      readonly validatorType: "ecdsa_secp256k1";
      readonly account: LocalAccount<"namera-secp256k1">;
    };

export type AlchemyModularV2CreationOwner =
  | {
      readonly validatorType: "webauthn_p256";
      readonly publicKey: Hex;
    }
  | Extract<AlchemyModularV2Owner, { validatorType: "ecdsa_secp256k1" }>;

export type ReconstructEvmAccountInput = {
  readonly wallet: AlchemyModularV2WalletData;
  readonly owner: AlchemyModularV2Owner;
};
