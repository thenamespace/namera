import { Schema } from "effect";

import { BigIntFromString, EthereumAddress, Hex } from "./common";

const CallType = Schema.Literals(["call", "delegatecall", "batch-call"]);

const ParamCondition = Schema.Literals([
  "EQUAL",
  "GREATER_THAN",
  "LESS_THAN",
  "GREATER_THAN_OR_EQUAL",
  "LESS_THAN_OR_EQUAL",
  "NOT_EQUAL",
  "ONE_OF",
  "SLICE_EQUAL",
]);

const ConditionValue = Schema.Union([
  Schema.Struct({
    condition: ParamCondition.pick(["ONE_OF"]),
    value: Schema.Array(Schema.Any),
  }),
  Schema.Struct({
    condition: ParamCondition.pick(["SLICE_EQUAL"]),
    value: Schema.Any,
    start: Schema.Number,
    length: Schema.Number,
  }),
  Schema.Struct({
    condition: ParamCondition.pick([
      "EQUAL",
      "GREATER_THAN",
      "LESS_THAN",
      "GREATER_THAN_OR_EQUAL",
      "LESS_THAN_OR_EQUAL",
      "NOT_EQUAL",
      "SLICE_EQUAL",
    ]),
    value: Schema.Any,
  }),
]);

const ParamRule = Schema.Struct({
  condition: ParamCondition,
  offset: Schema.Number,
  params: Schema.Union([Hex, Schema.Array(Hex)]),
});

const PermissionManual = Schema.Struct({
  callType: Schema.optional(CallType),
  target: EthereumAddress,
  selector: Hex,
  valueLimit: Schema.optional(BigIntFromString),
  rules: Schema.optional(Schema.Array(ParamRule)),
});

const PermissionWithABI = Schema.Struct({
  callType: Schema.optional(CallType),
  target: EthereumAddress,
  selector: Hex,
  valueLimit: Schema.optional(BigIntFromString),
  abi: Schema.Any,
  functionName: Schema.String,
  args: Schema.Array(ConditionValue),
});

export const Permission = Schema.Union([PermissionManual, PermissionWithABI]);
