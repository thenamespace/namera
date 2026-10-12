import { Schema } from "effect";

import { AddressCatalogId } from "#/common/brand";
import { TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

import { EvmContractCatalogData } from "./evm/contract.js";
import { Erc20CatalogData } from "./evm/erc20.js";

export const AddressCatalog = Schema.Struct({
  id: AddressCatalogId,
  namespace: Schema.Literal("eip155"),
  slug: Schema.String,
  search: Schema.Array(Schema.String),
  data: Schema.Union([Erc20CatalogData, EvmContractCatalogData]),
  status: Schema.Literals(["draft", "published", "archived"]),
  revision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  ...TimestampFields,
});

export const AddressCatalogInsert = createInsertSchema(
  AddressCatalog,
  "namespace",
  "slug",
  "search",
  "data",
);

export type AddressCatalog = typeof AddressCatalog.Type;
export type AddressCatalogEncoded = typeof AddressCatalog.Encoded;
export type AddressCatalogInsert = typeof AddressCatalogInsert.Type;
