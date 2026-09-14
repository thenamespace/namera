import { Schema } from "effect";

import { EvmSessionPermission } from "@namera-ai/protocol/evm";
import { describe, expect, it } from "vitest";

import { sessionKeyPolicyCount } from "../../src/components/session-key-select/policy-count";

describe("authorization session policy count", () => {
  const permission = Schema.decodeUnknownSync(EvmSessionPermission)({
    type: "gas-limit",
    limit: "100",
  });
  const authorization = { permissions: [permission], allowSignatures: true };
  it("adds both enforcement types without multiplying identical network copies", () => {
    expect(
      sessionKeyPolicyCount({
        policies: [{}],
        installations: [{ authorization }, { authorization }],
      }),
    ).toBe(3);
  });
  it("counts distinct onchain rules and supports empty policies", () => {
    expect(sessionKeyPolicyCount({ policies: [], installations: [] })).toBe(0);
    expect(
      sessionKeyPolicyCount({
        policies: [],
        installations: [{ authorization: { permissions: [permission], allowSignatures: false } }],
      }),
    ).toBe(1);
  });
});
