import { Schema } from "effect";

import { AddressCatalogEntryId, AddressCatalogId, ContractInterfaceId } from "#/common/brand";
import { SupportedEvmChainId } from "#/evm/chains";
import { EthereumAddress } from "#/evm/primitives";
import { TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

import { EvmContractCatalogEntryData } from "./evm/contract.js";
import { Erc20CatalogEntryData } from "./evm/erc20.js";

export const AddressCatalogEntry = Schema.Struct({
  id: AddressCatalogEntryId,
  catalogId: AddressCatalogId,
  namespace: Schema.Literal("eip155"),
  chainId: SupportedEvmChainId,
  address: EthereumAddress,
  interfaceId: Schema.NullOr(ContractInterfaceId),
  data: Schema.Union([Erc20CatalogEntryData, EvmContractCatalogEntryData]),
  status: Schema.Literals(["active", "deprecated", "disabled"]),
  revision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  ...TimestampFields,
});

export const AddressCatalogEntryInsert = createInsertSchema(
  AddressCatalogEntry,
  "catalogId",
  "namespace",
  "chainId",
  "address",
  "data",
);

export type AddressCatalogEntry = typeof AddressCatalogEntry.Type;
export type AddressCatalogEntryEncoded = typeof AddressCatalogEntry.Encoded;
export type AddressCatalogEntryInsert = typeof AddressCatalogEntryInsert.Type;
