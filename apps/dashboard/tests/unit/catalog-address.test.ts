import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import {
  customAddressSchema,
  customPickerSchema,
} from "../../src/components/evm-address-picker/schema.js";

const address = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

describe("custom policy address boundary", () => {
  const decode = Schema.decodeUnknownSync(customAddressSchema(["eip155:1"]));
  it("accepts a full EVM address on an allowed network", () => {
    expect(decode({ address, chainId: "eip155:1" })).toEqual({ address, chainId: "eip155:1" });
  });
  it("rejects a supported network outside the picker scope", () => {
    expect(() => decode({ address, chainId: "eip155:8453" })).toThrow();
  });
  it.each(["0x1234", "vitalik.eth", "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"])(
    "rejects malformed or incorrectly checksummed input: %s",
    (invalid) => {
      expect(() => decode({ address: invalid, chainId: "eip155:1" })).toThrow();
    },
  );
  it("does not allow custom addresses when the chain scope is empty", () => {
    expect(() =>
      Schema.decodeUnknownSync(customAddressSchema([]))({ address, chainId: "eip155:1" }),
    ).toThrow();
  });
});

describe("custom ERC-20 decimals", () => {
  const decode = Schema.decodeUnknownSync(customPickerSchema(["eip155:1"], true));
  it.each([0, 6, 18, 255])("accepts explicit decimals %s", (decimals) => {
    expect(decode({ address, chainId: "eip155:1", decimals }).decimals).toBe(decimals);
  });
  it.each([undefined, -1, 256, 1.5, NaN, "6"])(
    "rejects missing or invalid decimals %s",
    (decimals) => {
      expect(() =>
        decode({ address, chainId: "eip155:1", ...(decimals === undefined ? {} : { decimals }) }),
      ).toThrow();
    },
  );
  it("does not require decimals for custom contracts", () => {
    expect(
      Schema.decodeUnknownSync(customPickerSchema(["eip155:1"], false))({
        address,
        chainId: "eip155:1",
      }),
    ).toEqual({ address, chainId: "eip155:1" });
  });
});
