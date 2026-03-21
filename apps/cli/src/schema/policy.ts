import { Schema } from "effect";

import { BigIntFromString, EthereumAddress } from "./common";
import { Permission } from "./permission";

export const SudoPolicyParams = Schema.Struct({
  type: Schema.Literal("sudo"),
});

export const TimestampPolicyParams = Schema.Struct({
  type: Schema.Literal("timestamp"),
  validAfter: Schema.optional(Schema.Number)
    .pipe(Schema.withDecodingDefault(() => 0))
    .annotate({
      description:
        "The timestamp in seconds after which signer is valid. If not provided, the signer is valid immediately.",
    }),
  validUntil: Schema.optional(Schema.Number)
    .pipe(Schema.withDecodingDefault(() => 0))
    .annotate({
      description:
        "The timestamp in seconds until which signer is valid. If not provided, the signer is valid indefinitely.",
    }),
});

export const SignatureCallerPolicyParams = Schema.Struct({
  type: Schema.Literal("signature-caller"),
  allowedCallers: Schema.optional(Schema.Array(EthereumAddress)).annotate({
    description:
      "List of addresses that are allowed to validate messages signed by the signer.",
  }),
});

export const RateLimitPolicyParams = Schema.Struct({
  type: Schema.Literal("rate-limit"),
  interval: Schema.optional(Schema.Number).annotate({
    description: "Length of interval in seconds",
  }),
  count: Schema.Number.annotate({
    description: "The number of calls allowed within the interval",
  }),
  startAt: Schema.optional(Schema.Number).annotate({
    description:
      "The timestamp in seconds at which the rate limit starts. Before this signer cannot sign any UserOperations",
  }),
});

export const GasPolicyParams = Schema.Struct({
  type: Schema.Literal("gas"),
  amount: Schema.optional(BigIntFromString).annotate({
    description:
      "Amount, in wei that the signer can spend on gas, in total across all UserOps it sends.",
    default: 0n,
  }),
  enforcePaymaster: Schema.optional(Schema.Boolean).annotate({
    description: "If set to true, enforce that a paymaster must be used.",
    default: false,
  }),
});

export const CallPolicyParams = Schema.Struct({
  type: Schema.Literal("call"),
  policyVersion: Schema.Literals(["0.0.1", "0.0.2", "0.0.3", "0.0.4", "0.0.5"]),
  permissions: Schema.optional(Schema.Array(Permission)),
});

export const PolicyParams = Schema.Union([
  SudoPolicyParams,
  TimestampPolicyParams,
  SignatureCallerPolicyParams,
  RateLimitPolicyParams,
  GasPolicyParams,
  CallPolicyParams,
]);

export type SudoPolicyParams = typeof SudoPolicyParams.Type;
export type TimestampPolicyParams = typeof TimestampPolicyParams.Type;
export type SignatureCallerPolicyParams =
  typeof SignatureCallerPolicyParams.Type;
export type RateLimitPolicyParams = typeof RateLimitPolicyParams.Type;
export type GasPolicyParams = typeof GasPolicyParams.Type;
export type CallPolicyParams = typeof CallPolicyParams.Type;
export type PolicyParams = typeof PolicyParams.Type;
