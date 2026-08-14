import { Effect, Schema } from "effect";

import { cryptoPurpose, type CryptoService } from "@namera-ai/crypto";
import { EvmSessionKeyPolicies } from "@namera-ai/protocol/model";

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON requires finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .filter((entry) => entry[1] !== undefined)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  throw new TypeError("Unsupported canonical JSON value");
};

export const hashSessionKeyPolicies = Effect.fnUntraced(function* (
  crypto: CryptoService["Service"],
  policies: EvmSessionKeyPolicies,
) {
  const encoded = Schema.encodeSync(EvmSessionKeyPolicies)(policies);
  const canonicalPolicies = encoded
    .map(({ id: _id, ...policy }) => canonicalJson(policy))
    .toSorted()
    .join(",");
  return yield* crypto.hash({
    purpose: cryptoPurpose.sessionKeyPolicies,
    value: `[${canonicalPolicies}]`,
  });
});
