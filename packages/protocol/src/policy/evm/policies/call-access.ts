import { Schema } from "effect";

import { PolicyId } from "#/common/index";
import { EthereumAddress, Hex } from "#/evm/primitives";

const Functions = Schema.Array(Hex.check(Schema.isPattern(/^0x[0-9a-fA-F]{8}$/))).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(64),
  Schema.makeFilter((values) =>
    new Set(values.map((value) => value.toLowerCase())).size === values.length
      ? undefined
      : "Duplicate function selector",
  ),
);
const common = { version: Schema.Literal(1) };
const persisted = { id: PolicyId, appliesTo: Schema.Literal("execution") };
const contracts = {
  ...common,
  type: Schema.Literal("evm.contract-access"),
  address: EthereumAddress,
};
const functions = {
  ...common,
  type: Schema.Literal("evm.functions-on-contract"),
  address: EthereumAddress,
  functions: Functions,
};
const wildcard = {
  ...common,
  type: Schema.Literal("evm.functions-on-all-contracts"),
  functions: Functions,
};
const account = { ...common, type: Schema.Literal("evm.account-functions"), functions: Functions };

export const CreateEvmContractAccessPolicy = Schema.Struct(contracts);
export const EvmContractAccessPolicy = Schema.Struct({ ...persisted, ...contracts });
export const CreateEvmContractFunctionsPolicy = Schema.Struct(functions);
export const EvmContractFunctionsPolicy = Schema.Struct({ ...persisted, ...functions });
export const CreateEvmWildcardFunctionsPolicy = Schema.Struct(wildcard);
export const EvmWildcardFunctionsPolicy = Schema.Struct({ ...persisted, ...wildcard });
export const CreateEvmAccountFunctionsPolicy = Schema.Struct(account);
export const EvmAccountFunctionsPolicy = Schema.Struct({ ...persisted, ...account });
export const EvmCallAccessPolicy = Schema.Union([
  EvmContractAccessPolicy,
  EvmContractFunctionsPolicy,
  EvmWildcardFunctionsPolicy,
  EvmAccountFunctionsPolicy,
]);
export type EvmCallAccessPolicy = typeof EvmCallAccessPolicy.Type;
