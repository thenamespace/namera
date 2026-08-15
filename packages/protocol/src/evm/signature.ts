import { Schema } from "effect";

import { NonEmptyString } from "#/model/common";

import { SupportedEvmChainId } from "./chains.js";
import { Bytes32, EthereumAddress } from "./primitives.js";

export const EvmSignatureType = Schema.Literals(["message", "typed-data"]);

export const EvmTypedDataField = Schema.Struct({
  name: NonEmptyString,
  type: NonEmptyString,
});

export const EvmTypedDataDomain = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  version: Schema.optionalKey(Schema.String),
  chainId: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  verifyingContract: Schema.optionalKey(EthereumAddress),
  salt: Schema.optionalKey(Bytes32),
});

export const EvmTypedData = Schema.Struct({
  domain: EvmTypedDataDomain,
  types: Schema.Record(
    NonEmptyString,
    Schema.Array(EvmTypedDataField).check(
      Schema.isMinLength(1, { message: "Typed-data structs must contain at least one field" }),
    ),
  ),
  primaryType: NonEmptyString,
  message: Schema.Record(Schema.String, Schema.Json),
});

const EvmSignatureContextCommon = {
  version: Schema.Literal(1),
  namespace: Schema.Literal("eip155"),
  chainId: SupportedEvmChainId,
  account: EthereumAddress,
  timestamp: Schema.DateTimeUtcFromDate,
};

export const EvmMessageSignatureContext = Schema.Struct({
  ...EvmSignatureContextCommon,
  type: Schema.Literal("message"),
  message: Schema.String,
});

export const EvmTypedDataSignatureContext = Schema.Struct({
  ...EvmSignatureContextCommon,
  type: Schema.Literal("typed-data"),
  typedData: EvmTypedData,
});

export const EvmSignatureContext = Schema.Union(
  [EvmMessageSignatureContext, EvmTypedDataSignatureContext],
  { mode: "oneOf" },
).annotate({
  identifier: "EvmSignatureContext",
  description: "A normalized EVM signature request evaluated independently from execution intents",
});

export type EvmSignatureType = typeof EvmSignatureType.Type;
export type EvmTypedDataField = typeof EvmTypedDataField.Type;
export type EvmTypedDataDomain = typeof EvmTypedDataDomain.Type;
export type EvmTypedData = typeof EvmTypedData.Type;
export type EvmMessageSignatureContext = typeof EvmMessageSignatureContext.Type;
export type EvmTypedDataSignatureContext = typeof EvmTypedDataSignatureContext.Type;
export type EvmSignatureContext = typeof EvmSignatureContext.Type;
