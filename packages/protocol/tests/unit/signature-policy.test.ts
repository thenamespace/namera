import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import { CreateEvmSessionKeyRequest } from "../../src/dto/session-key/index.js";

// Exercise the policy schema used by session registration, not a parallel validator.
const decode = Schema.decodeUnknownSync(CreateEvmSessionKeyRequest.fields.policies);
const policy = { type: "evm.signature", version: 1, allowedTypes: ["typed-data"] };
const rule = {
  chainId: "eip155:1",
  verifyingContract: "0x1111111111111111111111111111111111111111",
  primaryTypes: ["Permit"],
};

describe("signature policy creation contract", () => {
  it("allows typed data without restrictions but rejects an explicit empty allowlist", () => {
    expect(decode([policy])).toEqual([policy]);
    expect(decode([{ ...policy, allowedTypes: ["message", "typed-data"] }])).toHaveLength(1);
    expect(() => decode([{ ...policy, typedDataRules: [] }])).toThrow();
    expect(decode([{ ...policy, allowedTypes: ["message"] }])).toHaveLength(1);
  });

  it("accepts exact tuples and rejects incomplete rules", () => {
    const restricted = { ...policy, typedDataRules: [{ ...rule, name: "", version: "1" }] };
    expect(decode([restricted])).toEqual([restricted]);
    expect(() =>
      decode([{ ...policy, typedDataRules: [{ ...rule, primaryTypes: [] }] }]),
    ).toThrow();
    expect(() => decode([{ ...policy, typedDataRules: [{ chainId: rule.chainId }] }])).toThrow();
  });
});
