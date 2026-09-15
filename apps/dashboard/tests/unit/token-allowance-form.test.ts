import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import {
  TokenAllowanceForm,
  tokenAllowanceDefaults,
  toTokenAllowancePermission,
} from "../../src/components/policy/evm/onchain/token-allowance/form";

const decode = Schema.decodeUnknownSync(TokenAllowanceForm);
const address = "0x1111111111111111111111111111111111111111";
const make = (amount: string, decimals = "6") =>
  toTokenAllowancePermission(decode({ address, amount, decimals }));

describe("token allowance form", () => {
  it("defaults to six decimals and converts token amounts exactly", () => {
    expect(tokenAllowanceDefaults().decimals).toBe("6");
    expect(make("1.25")).toMatchObject({ allowance: "1250000" });
    expect(make("0.000000000000000001", "18")).toMatchObject({ allowance: "1" });
    expect(make("2", "0")).toMatchObject({ allowance: "2" });
    expect(make("0")).toMatchObject({ allowance: "0" });
  });
  it("preserves stored base units on reopening even for other decimal settings", () => {
    const permission = make("1.234567890123456789", "18");
    expect(toTokenAllowancePermission(decode(tokenAllowanceDefaults(permission)))).toEqual(
      permission,
    );
  });
  it("rejects rounding, negative amounts, invalid decimals and overflow", () => {
    for (const amount of ["0.0000001", "-1", "1e6", "NaN", ""])
      expect(() => make(amount)).toThrow();
    for (const decimals of ["-1", "256", "1.5", ""]) expect(() => make("1", decimals)).toThrow();
    expect(() => make((2n ** 256n).toString(), "0")).toThrow();
    expect(make((2n ** 256n - 1n).toString(), "0")).toMatchObject({
      allowance: (2n ** 256n - 1n).toString(),
    });
  });
});
