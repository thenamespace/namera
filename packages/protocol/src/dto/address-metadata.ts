import { Schema } from "effect";

import { EthereumAddress, SupportedEvmChainId } from "#/evm/index";
import { EvmAddressMetadataData } from "#/model/core/address-metadata";
import { NonEmptyString } from "#/model/index";

export const EvmAddressReference = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  chainId: SupportedEvmChainId,
  address: EthereumAddress,
}).annotate({
  identifier: "EvmAddressReference",
  description: "A canonical EVM address on one supported chain",
});

export const AddressReference = Schema.Union([EvmAddressReference], { mode: "oneOf" }).annotate({
  identifier: "AddressReference",
});

export const GetAddressMetadataRequest = EvmAddressReference.annotate({
  identifier: "GetAddressMetadataRequest",
});

export const AddressMetadataResponse = EvmAddressMetadataData.annotate({
  identifier: "AddressMetadataResponse",
});

export const ResolveAddressMetadataRequest = Schema.Struct({
  addresses: Schema.Array(AddressReference).pipe(
    Schema.check(Schema.isMinLength(1), Schema.isMaxLength(50)),
  ),
}).annotate({
  identifier: "ResolveAddressMetadataRequest",
  description: "Resolve a batch of namespace-qualified addresses",
});

export const ResolveAddressMetadataResponse = Schema.Struct({
  items: Schema.Array(AddressMetadataResponse),
}).annotate({ identifier: "ResolveAddressMetadataResponse" });

export const AddressMetadataSearchCursor = NonEmptyString.annotate({
  identifier: "AddressMetadataSearchCursor",
});

export const SearchAddressMetadataRequest = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  chainId: SupportedEvmChainId,
  query: NonEmptyString.pipe(Schema.check(Schema.isMaxLength(100))),
  cursor: Schema.optionalKey(AddressMetadataSearchCursor),
}).annotate({ identifier: "SearchAddressMetadataRequest" });

export const SearchAddressMetadataResponse = Schema.Struct({
  items: Schema.Array(AddressMetadataResponse),
  nextCursor: Schema.NullOr(AddressMetadataSearchCursor),
}).annotate({ identifier: "SearchAddressMetadataResponse" });

export type EvmAddressReference = typeof EvmAddressReference.Type;
export type AddressReference = typeof AddressReference.Type;
export type GetAddressMetadataRequest = typeof GetAddressMetadataRequest.Type;
export type AddressMetadataResponse = typeof AddressMetadataResponse.Type;
export type ResolveAddressMetadataRequest = typeof ResolveAddressMetadataRequest.Type;
export type ResolveAddressMetadataResponse = typeof ResolveAddressMetadataResponse.Type;
export type AddressMetadataSearchCursor = typeof AddressMetadataSearchCursor.Type;
export type SearchAddressMetadataRequest = typeof SearchAddressMetadataRequest.Type;
export type SearchAddressMetadataResponse = typeof SearchAddressMetadataResponse.Type;
