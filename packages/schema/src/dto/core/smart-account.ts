import { Schema } from "effect";

import { EthereumAddress, SmartAccountId } from "@/common";
import { SmartAccountMetadata, SmartAccount } from "@/core";

export const GetSmartAccountRequest = Schema.Union([
  Schema.Struct({
    id: SmartAccountId,
  }),
  Schema.Struct({
    address: EthereumAddress,
  }),
]);
export const GetSmartAccountResponse = Schema.UndefinedOr(SmartAccount);

export const CreateSmartAccountRequest = Schema.Struct({
  metadata: SmartAccountMetadata,
  ownerType: Schema.Literal("ecdsa"),
  owner: EthereumAddress,
});
export const CreateSmartAccountResponse = SmartAccount;

export const ListSmartAccountsRequest = Schema.Undefined;
export const ListSmartAccountsResponse = Schema.Array(SmartAccount);

export type GetSmartAccountRequest = typeof GetSmartAccountRequest.Type;
export type GetSmartAccountResponse = typeof GetSmartAccountResponse.Type;
export type CreateSmartAccountRequest = typeof CreateSmartAccountRequest.Type;
export type CreateSmartAccountResponse = typeof CreateSmartAccountResponse.Type;
export type ListSmartAccountsRequest = typeof ListSmartAccountsRequest.Type;
export type ListSmartAccountsResponse = typeof ListSmartAccountsResponse.Type;
