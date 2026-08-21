import { Schema, Struct } from "effect";

import { EthereumAddress, SupportedEvmChainId } from "#/evm/index";
import { TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

export const AddressMetadataNamespace = Schema.Literal("eip155").annotate({
  identifier: "AddressMetadataNamespace",
  description: "Namespace containing the enriched address",
});

export const AddressMetadataKind = Schema.Literals([
  "eoa",
  "contract",
  "fungible-token",
  "nft-contract",
  "unknown",
]);

export const AddressMetadataReputation = Schema.Literals([
  "credible",
  "neutral",
  "suspicious",
  "scam",
  "unknown",
]);

export const AddressMetadataTag = Schema.Struct({
  type: Schema.Literals(["name", "category", "protocol", "information", "classifier", "note"]),
  slug: Schema.String,
  name: Schema.String,
});

export const EvmAddressMetadataData = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  namespace: Schema.Literal("eip155"),
  chainId: SupportedEvmChainId,
  address: EthereumAddress,
  kind: AddressMetadataKind,
  identity: Schema.Struct({
    displayName: Schema.NullOr(Schema.String),
    description: Schema.NullOr(Schema.String),
    iconUrl: Schema.NullOr(Schema.String),
  }),
  trust: Schema.Struct({
    reputation: AddressMetadataReputation,
    isScam: Schema.Boolean,
    isSourceVerified: Schema.NullOr(Schema.Boolean),
    signals: Schema.Array(Schema.Literals(["blockscout", "metadata-tag", "token-market"])),
  }),
  tags: Schema.Array(AddressMetadataTag),
  token: Schema.NullOr(
    Schema.Struct({
      standard: Schema.Literals(["erc20", "erc721", "erc1155", "other"]),
      name: Schema.NullOr(Schema.String),
      symbol: Schema.NullOr(Schema.String),
      decimals: Schema.NullOr(Schema.Int),
      logoUrl: Schema.NullOr(Schema.String),
    }),
  ),
  contract: Schema.NullOr(
    Schema.Struct({
      name: Schema.NullOr(Schema.String),
      proxyType: Schema.NullOr(Schema.String),
      implementationAddress: Schema.NullOr(EthereumAddress),
      implementationName: Schema.NullOr(Schema.String),
    }),
  ),
  provenance: Schema.Struct({
    provider: Schema.Literal("blockscout"),
    observedAt: Schema.DateTimeUtcFromString,
  }),
}).annotate({
  identifier: "EvmAddressMetadataData",
  description: "Provider-neutral identity and trust metadata for an EVM address",
});

export const AddressMetadataData = Schema.Union([EvmAddressMetadataData], {
  mode: "oneOf",
}).annotate({ identifier: "AddressMetadataData" });

export const AddressMetadata = Schema.Struct({
  namespace: AddressMetadataNamespace,
  chainId: SupportedEvmChainId,
  address: EthereumAddress,
  data: AddressMetadataData,
  observedAt: Schema.DateTimeUtcFromDate,
  refreshAfter: Schema.DateTimeUtcFromDate,
}).mapFields(Struct.assign(TimestampFields));

export const AddressMetadataInsert = createInsertSchema(
  AddressMetadata,
  "namespace",
  "chainId",
  "address",
  "data",
  "observedAt",
  "refreshAfter",
);

export type AddressMetadataNamespace = typeof AddressMetadataNamespace.Type;
export type AddressMetadataKind = typeof AddressMetadataKind.Type;
export type AddressMetadataReputation = typeof AddressMetadataReputation.Type;
export type AddressMetadataTag = typeof AddressMetadataTag.Type;
export type EvmAddressMetadataData = typeof EvmAddressMetadataData.Type;
export type AddressMetadataData = typeof AddressMetadataData.Type;
export type AddressMetadata = typeof AddressMetadata.Type;
export type AddressMetadataEncoded = typeof AddressMetadata.Encoded;
export type AddressMetadataInsert = typeof AddressMetadataInsert.Type;
