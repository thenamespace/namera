import { Schema } from "effect";

import { ContractInterfaceId } from "#/common/brand";
import { createInsertSchema } from "#/model/helpers";

import { CatalogSourceUrl } from "./common.js";
import { EvmJsonAbi } from "./evm/abi.js";

export const ContractInterfaceData = Schema.Struct({
  version: Schema.Literal(1),
  type: Schema.Literal("evm-abi"),
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128), Schema.isPattern(/\S/)),
});
export type ContractInterfaceData = typeof ContractInterfaceData.Type;

export const ContractInterface = Schema.Struct({
  id: ContractInterfaceId,
  data: ContractInterfaceData,
  format: Schema.Literal("evm-abi"),
  document: EvmJsonAbi,
  contentHash: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  sourceUrl: CatalogSourceUrl,
  createdAt: Schema.DateTimeUtcFromDate,
});

export const ContractInterfaceInsert = createInsertSchema(
  ContractInterface,
  "format",
  "data",
  "document",
  "contentHash",
  "sourceUrl",
);

export type ContractInterface = typeof ContractInterface.Type;
export type ContractInterfaceEncoded = typeof ContractInterface.Encoded;
export type ContractInterfaceInsert = typeof ContractInterfaceInsert.Type;
