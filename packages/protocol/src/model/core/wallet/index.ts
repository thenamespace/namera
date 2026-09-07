import { Schema } from "effect";
import { Struct } from "effect";

import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

import { WalletCommon } from "./base.js";
import { EvmWalletData } from "./evm.js";

export const EvmWallet = WalletCommon.mapFields(Struct.assign(EvmWalletData.fields));

export const Wallet = Schema.Union([EvmWallet]);

export const WalletUpdate = createUpdateSchema(Wallet);
export const WalletInsert = createInsertSchema(
  Wallet,
  "organizationId",
  "signingKeyId",
  "metadata",
  "status",
  "createdByActorId",
  "namespace",
  "data",
);

export type EvmWallet = typeof EvmWallet.Type;
export type Wallet = typeof Wallet.Type;
export type WalletEncoded = typeof Wallet.Encoded;
export type WalletUpdate = typeof WalletUpdate.Type;
export type WalletInsert = typeof WalletInsert.Type;

export * from "./base.js";
export * from "./evm.js";
