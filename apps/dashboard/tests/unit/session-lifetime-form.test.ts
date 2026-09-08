import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { CreateEvmSessionKeyRequest } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { encodeDateValue, parseDateValue } from "../../src/lib/helpers/date";

const resolve = standardSchemaResolver(
  Schema.toStandardSchemaV1(Schema.Struct({ onchain: CreateEvmSessionKeyRequest.fields.onchain })),
);
const options = { fields: {}, shouldUseNativeValidation: false };
const onchain = {
  chains: ["eip155:8453"],
  validAfter: 0,
  validUntil: 2_000_000_000,
  permissions: [{ type: "native-token-transfer", allowance: "1000" }],
  allowSignatures: false,
} as const;

describe("session lifetime form", () => {
  it("attaches reversed lifetime errors to the expiry control", async () => {
    const result = await resolve(
      { onchain: { ...onchain, validAfter: onchain.validUntil } },
      undefined,
      options,
    );
    expect(result.errors).toHaveProperty("onchain.validUntil.message");
    expect(result.values).toEqual({});
  });

  it("requires networks and expiry while allowing immediate starts", async () => {
    const rejected = await resolve(
      { onchain: { ...onchain, chains: [], validUntil: 0 } },
      undefined,
      options,
    );
    expect(rejected.errors).toHaveProperty("onchain.chains.message");
    expect(rejected.errors).toHaveProperty("onchain.validUntil.message");
    const accepted = await resolve({ onchain }, undefined, options);
    expect(accepted.errors).toEqual({});
    expect(accepted.values).toHaveProperty("onchain.validAfter", 0);
    expect(accepted.values).toHaveProperty("onchain.allowSignatures", false);
  });

  it("preserves the selected instant through local date rendering", () => {
    for (const value of ["2030-03-10T07:30:00.000Z", "2030-11-03T06:30:00.000Z"]) {
      expect(encodeDateValue(parseDateValue(value))).toBe(value);
    }
    expect(encodeDateValue(parseDateValue(null))).toBeNull();
  });
});
