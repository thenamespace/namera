import { Schema } from "effect";

import { EthereumAddress, Hex } from "./primitives.js";

const Amount = Schema.BigIntFromString.check(
  Schema.isGreaterThanOrEqualToBigInt(0n),
  Schema.isLessThanOrEqualToBigInt(2n ** 256n - 1n),
);
const Selector = Hex.check(Schema.isPattern(/^0x[0-9a-fA-F]{8}$/));
const Functions = Schema.Array(Selector).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(64),
  Schema.makeFilter((values) =>
    new Set(values.map((value) => value.toLowerCase())).size === values.length
      ? undefined
      : "Duplicate function selector",
  ),
);

/** Amounts are base units, never floating-point token values or USD. */
export const EvmSessionPermission = Schema.Union([
  Schema.Struct({ type: Schema.Literal("native-token-transfer"), allowance: Amount }),
  Schema.Struct({
    type: Schema.Literal("erc20-token-transfer"),
    address: EthereumAddress,
    allowance: Amount,
  }),
  Schema.Struct({ type: Schema.Literal("gas-limit"), limit: Amount }),
  Schema.Struct({ type: Schema.Literal("contract-access"), address: EthereumAddress }),
  Schema.Struct({ type: Schema.Literal("account-functions"), functions: Functions }),
  Schema.Struct({ type: Schema.Literal("functions-on-all-contracts"), functions: Functions }),
  Schema.Struct({
    type: Schema.Literal("functions-on-contract"),
    address: EthereumAddress,
    functions: Functions,
  }),
  Schema.Struct({ type: Schema.Literal("root") }),
]).annotate({
  identifier: "EvmSessionPermission",
  description:
    "An onchain Modular Account permission. Access grants are additive; spend hooks constrain them. Root grants unrestricted account authority and cannot be combined with another permission.",
});

export const EvmSessionPermissions = Schema.Array(EvmSessionPermission)
  .check(Schema.isMinLength(1))
  .check(
    Schema.makeFilter((permissions) => {
      if (permissions.some((permission) => permission.type === "root") && permissions.length !== 1)
        return "Root must be the only onchain permission";

      const seen = new Set<string>();
      for (const permission of permissions) {
        // The provider encodes per-target storage. Reject overlapping targets rather
        // than letting the order of permissions overwrite an earlier restriction.
        const key =
          "address" in permission ? `target:${permission.address.toLowerCase()}` : permission.type;
        if (seen.has(key)) return "Duplicate onchain permission or target";
        seen.add(key);
      }
      return undefined;
    }),
  );

export const EvmSessionEntityId = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(1),
  Schema.isLessThanOrEqualTo(2_147_483_646),
).annotate({
  description: "Non-root validation entity. The upper half of uint32 is reserved for hook storage.",
});

const Timestamp = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(281_474_976_710_655),
);

export const EvmSessionAuthorization = Schema.Struct({
  version: Schema.Literal(1),
  entityId: EvmSessionEntityId,
  signerAddress: EthereumAddress,
  permissions: EvmSessionPermissions,
  allowSignatures: Schema.optionalKey(Schema.Boolean).annotate({
    description:
      "Explicit ERC-1271 signature authority; omitted means false. Onchain time, spend and call hooks do not restrict signatures. Uninstall the validation to revoke this authority onchain.",
  }),
  validAfter: Timestamp,
  validUntil: Timestamp,
}).check(
  Schema.makeFilter((value) =>
    value.validUntil > value.validAfter ? undefined : "Session expiry must follow its start time",
  ),
);

export type EvmSessionPermission = typeof EvmSessionPermission.Type;
export type EvmSessionPermissions = typeof EvmSessionPermissions.Type;
export type EvmSessionEntityId = typeof EvmSessionEntityId.Type;
export type EvmSessionAuthorization = typeof EvmSessionAuthorization.Type;
