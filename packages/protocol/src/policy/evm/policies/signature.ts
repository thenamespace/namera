import { Schema } from "effect";

import { PolicyId } from "#/common/index";
import { SupportedEvmChainId } from "#/evm/chains";
import { EthereumAddress } from "#/evm/primitives";
import { EvmSignatureType } from "#/evm/signature";
import { NonEmptyString } from "#/model/common";

const TypedDataRule = Schema.Struct({
  chainId: SupportedEvmChainId,
  verifyingContract: EthereumAddress,
  name: Schema.optionalKey(Schema.String),
  version: Schema.optionalKey(Schema.String),
  primaryTypes: Schema.Array(NonEmptyString).check(Schema.isMinLength(1), Schema.isUnique()),
});

const EvmSignaturePolicyFields = {
  type: Schema.Literal("evm.signature"),
  version: Schema.Literal(1),
  allowedTypes: Schema.Array(EvmSignatureType)
    .check(Schema.isMinLength(1, { message: "At least one signature type is required" }))
    .check(Schema.isUnique()),
  typedDataRules: Schema.optionalKey(
    Schema.Array(TypedDataRule).check(Schema.isMinLength(1)).annotate({
      description:
        "Optional API-level EIP-712 allowlist. Omit to allow all typed data when typed-data is enabled. If provided, one complete rule must match the request chain, domain chain, verifying contract and primary type. Names and versions match exactly when specified. These checks do not restrict direct local signing outside Namera.",
    }),
  ),
};

export const EvmSignaturePolicy = Schema.Struct({
  id: PolicyId,
  appliesTo: Schema.Literal("signature"),
  ...EvmSignaturePolicyFields,
});

export const CreateEvmSignaturePolicy = Schema.Struct(EvmSignaturePolicyFields).annotate({
  identifier: "CreateEvmSignaturePolicy",
  description:
    "Allow selected EVM smart-account signature operations. Typed data is unrestricted unless an explicit allowlist is provided.",
});

export type EvmSignaturePolicy = typeof EvmSignaturePolicy.Type;
export type CreateEvmSignaturePolicy = typeof CreateEvmSignaturePolicy.Type;
