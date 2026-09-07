import { Effect } from "effect";

import type { AlchemyModularV2WalletData } from "@namera-ai/protocol/model";

import type { EvmConfigValues } from "../config.js";
import {
  createAlchemyModularV2Account,
  type CreateAlchemyModularV2AccountProps,
} from "./alchemy-modular-v2.js";
export type CreateAccountProps = CreateAlchemyModularV2AccountProps;
export type CreateAccountResult = AlchemyModularV2WalletData;

export const makeCreateAccount = (config: EvmConfigValues) =>
  Effect.fn("evm.createAccount")((props: CreateAccountProps) =>
    createAlchemyModularV2Account(props, config),
  );

export * from "./webauthn.js";
export * from "./secp256k1.js";
export type {
  AlchemyModularV2CreationOwner,
  AlchemyModularV2Owner,
  ReconstructEvmAccountInput,
} from "./types.js";
