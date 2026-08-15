import { Schema } from "effect";

import { OrganizationId, ValidatorType, WalletId } from "#/common/index";
import { EntryPointVersion, EthereumAddress, KernelVersion, SafeVersion } from "#/evm/index";
import {
  TimestampFields,
  WalletKeyProtectionLevel,
  WalletMetadata,
  WalletStatus,
} from "#/model/index";

export const CreateEvmWalletRequest = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  protectionLevel: WalletKeyProtectionLevel,
  metadata: WalletMetadata,
  implementation: Schema.Literals(["kernel", "safe"]),
}).annotate({
  identifier: "CreateEvmWalletRequest",
  description: "Create an EVM smart-account wallet",
});

export const CreateWalletRequest = CreateEvmWalletRequest.annotate({
  identifier: "CreateWalletRequest",
  description: "Create a wallet for the requested namespace, key protection, and implementation",
});

const WalletResponseFields = {
  id: WalletId,
  organizationId: OrganizationId,
  metadata: WalletMetadata,
  status: WalletStatus,
  namespace: Schema.Literal("eip155"),
  address: EthereumAddress,
  protectionLevel: WalletKeyProtectionLevel,
  ...TimestampFields,
};

export const KernelWalletResponse = Schema.Struct({
  ...WalletResponseFields,
  implementation: Schema.Literal("kernel"),
  data: Schema.Struct({
    version: Schema.Literal(1),
    kernelVersion: KernelVersion,
    validatorType: ValidatorType,
    entryPointVersion: EntryPointVersion,
    accountIndex: Schema.BigIntFromString,
  }),
}).annotate({
  identifier: "KernelWalletResponse",
  description: "A Kernel EVM smart-account wallet",
});

export const SafeWalletResponse = Schema.Struct({
  ...WalletResponseFields,
  implementation: Schema.Literal("safe"),
  data: Schema.Struct({
    version: Schema.Literal(1),
    safeVersion: SafeVersion,
    validatorType: ValidatorType,
    entryPointVersion: EntryPointVersion,
    saltNonce: Schema.BigIntFromString,
  }),
}).annotate({
  identifier: "SafeWalletResponse",
  description: "A Safe EVM smart-account wallet",
});

export const EvmWalletResponse = Schema.Union([KernelWalletResponse, SafeWalletResponse], {
  mode: "oneOf",
}).annotate({
  identifier: "EvmWalletResponse",
  description: "An EVM smart-account wallet",
});

export const WalletResponse = Schema.Union([EvmWalletResponse], { mode: "oneOf" }).annotate({
  identifier: "WalletResponse",
  description: "A wallet with its smart-account and key-protection details",
});

export const CreateWalletResponse = WalletResponse.annotate({
  identifier: "CreateWalletResponse",
});

export const GetWalletRequest = Schema.Struct({
  walletId: WalletId,
}).annotate({ identifier: "GetWalletRequest" });

export const GetWalletResponse = WalletResponse.annotate({
  identifier: "GetWalletResponse",
});

export const UpdateWalletRequest = Schema.Struct({
  metadata: WalletMetadata,
}).annotate({
  identifier: "UpdateWalletRequest",
  description: "Update wallet presentation metadata",
});

export const UpdateWalletResponse = WalletResponse.annotate({
  identifier: "UpdateWalletResponse",
});

export const ListWalletsResponse = Schema.Array(WalletResponse).annotate({
  identifier: "ListWalletsResponse",
});

export type CreateEvmWalletRequest = typeof CreateEvmWalletRequest.Type;
export type CreateWalletRequest = typeof CreateWalletRequest.Type;
export type EvmWalletResponse = typeof EvmWalletResponse.Type;
export type WalletResponse = typeof WalletResponse.Type;
export type CreateWalletResponse = typeof CreateWalletResponse.Type;
export type GetWalletRequest = typeof GetWalletRequest.Type;
export type GetWalletResponse = typeof GetWalletResponse.Type;
export type UpdateWalletRequest = typeof UpdateWalletRequest.Type;
export type UpdateWalletResponse = typeof UpdateWalletResponse.Type;
export type ListWalletsResponse = typeof ListWalletsResponse.Type;
