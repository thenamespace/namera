import type { AlchemyModularV2WalletData } from "@namera-ai/protocol/model";
import type { Hex } from "viem";
import type { WebAuthnAccount } from "viem/account-abstraction";

import type { Secp256k1OwnerAccount } from "./secp256k1.js";

export type AlchemyModularV2Owner =
  | {
      readonly validatorType: "webauthn_p256";
      readonly account: WebAuthnAccount;
    }
  | {
      readonly validatorType: "ecdsa_secp256k1";
      readonly account: Secp256k1OwnerAccount;
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
