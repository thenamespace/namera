import { Schema } from "effect";

import { PolicyId } from "#/common/index";
import { EvmSignatureType } from "#/evm/signature";

const EvmSignaturePolicyFields = {
  type: Schema.Literal("evm.signature"),
  version: Schema.Literal(1),
  allowedTypes: Schema.Array(EvmSignatureType)
    .check(Schema.isMinLength(1, { message: "At least one signature type is required" }))
    .check(Schema.isUnique()),
};

export const EvmSignaturePolicy = Schema.Struct({
  id: PolicyId,
  ...EvmSignaturePolicyFields,
});

export const CreateEvmSignaturePolicy = Schema.Struct(EvmSignaturePolicyFields).annotate({
  identifier: "CreateEvmSignaturePolicy",
  description: "Allow selected EVM smart-account signature operations",
});

export type EvmSignaturePolicy = typeof EvmSignaturePolicy.Type;
export type CreateEvmSignaturePolicy = typeof CreateEvmSignaturePolicy.Type;
