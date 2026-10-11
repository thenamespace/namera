import { Schema, Struct } from "effect";

import { SupportedEvmChainId } from "#/evm/chains";
import { EthereumAddress } from "#/evm/primitives";
import { AddressCatalog, AddressCatalogEntry, ContractInterface } from "#/model/catalog/index";

export const SearchCatalogRequest = Schema.Struct({
  query: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(200))),
  namespace: Schema.Literal("eip155"),
  chainId: Schema.optionalKey(SupportedEvmChainId),
  types: Schema.optionalKey(
    Schema.Array(Schema.Literals(["erc20", "contract"])).check(
      Schema.isMinLength(1),
      Schema.isMaxLength(2),
    ),
  ),
  limit: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 }))),
  offset: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 10000 }))),
});
export type SearchCatalogRequest = typeof SearchCatalogRequest.Type;

export const CatalogView = Schema.Struct({
  ...AddressCatalog.fields,
  entries: Schema.Array(AddressCatalogEntry),
});
export const CatalogEntryView = Schema.Struct({
  catalog: AddressCatalog,
  entry: AddressCatalogEntry,
});
export const SearchCatalogResponse = Schema.Struct({
  entries: Schema.Array(CatalogView),
  nextOffset: Schema.NullOr(Schema.Int),
});
export const CatalogAddress = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  chainId: SupportedEvmChainId,
  address: EthereumAddress,
});
export type CatalogAddress = typeof CatalogAddress.Type;
export const ResolveCatalogRequest = Schema.Struct({
  addresses: Schema.Array(CatalogAddress).check(Schema.isMinLength(1), Schema.isMaxLength(100)),
});
export const ResolveCatalogResponse = Schema.Array(
  Schema.Struct({
    ...CatalogAddress.fields,
    match: Schema.NullOr(CatalogEntryView),
  }),
);

export const ImportCatalogRecord = Schema.Struct({
  ...Struct.omit(AddressCatalog.fields, ["revision", "createdAt", "updatedAt"]),
  slug: Schema.String.check(Schema.isMaxLength(128), Schema.isPattern(/^[a-z0-9]+(-[a-z0-9]+)*$/)),
  search: Schema.Array(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128))).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(64),
  ),
});
export type ImportCatalogRecord = typeof ImportCatalogRecord.Type;
export const ImportCatalogEntry = Schema.Struct(
  Struct.omit(AddressCatalogEntry.fields, ["revision", "createdAt", "updatedAt"]),
);
export type ImportCatalogEntry = typeof ImportCatalogEntry.Type;
export const ImportCatalogInterface = Schema.Struct(
  Struct.omit(ContractInterface.fields, ["createdAt", "contentHash"]),
);
export type ImportCatalogInterface = typeof ImportCatalogInterface.Type;
export const ImportCatalogRequest = Schema.Struct({
  version: Schema.Literal(1),
  catalog: Schema.Array(ImportCatalogRecord).check(Schema.isMaxLength(500)),
  entries: Schema.Array(ImportCatalogEntry).check(Schema.isMaxLength(2000)),
  interfaces: Schema.Array(ImportCatalogInterface).check(Schema.isMaxLength(100)),
});
export type ImportCatalogRequest = typeof ImportCatalogRequest.Type;
export const ImportCatalogQuery = Schema.Struct({ dryRun: Schema.optionalKey(Schema.Boolean) });
const ImportCounts = Schema.Struct({
  created: Schema.Int,
  updated: Schema.Int,
  unchanged: Schema.Int,
});
export const ImportCatalogResponse = Schema.Struct({
  dryRun: Schema.Boolean,
  catalog: ImportCounts,
  entries: ImportCounts,
  interfaces: Schema.Struct({ created: Schema.Int, unchanged: Schema.Int }),
});
