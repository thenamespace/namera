import { Schema } from "effect";

import { PolicyId } from "#/common/index";
import { SupportedEvmChainId } from "#/evm/chains";

const ChainAllowlistFields = {
  type: Schema.Literal("evm.chain-allowlist"),
  version: Schema.Literal(1),
  chainIds: Schema.Array(SupportedEvmChainId)
    .check(Schema.isMinLength(1, { message: "Select at least one allowed chain" }))
    .check(Schema.isUnique({ message: "Each allowed chain may appear only once" })),
};

export const CreateEvmChainAllowlistPolicy = Schema.Struct(ChainAllowlistFields).annotate({
  identifier: "CreateEvmChainAllowlistPolicy",
  description: "The EVM networks where a session key may execute or sign",
});

export const EvmChainAllowlistPolicy = Schema.Struct({
  id: PolicyId,
  appliesTo: Schema.Literal("both"),
  ...ChainAllowlistFields,
}).annotate({
  identifier: "EvmChainAllowlistPolicy",
  description: "Persisted EVM network allowlist for a session key",
});

export type CreateEvmChainAllowlistPolicy = typeof CreateEvmChainAllowlistPolicy.Type;
export type EvmChainAllowlistPolicy = typeof EvmChainAllowlistPolicy.Type;
