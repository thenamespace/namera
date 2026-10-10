import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import { AlchemyModularV2WalletData } from "../../../src/model/core/wallet/evm.js";

const encoded = {
  version: 1,
  implementation: "alchemy-modular-v2",
  modularAccountVersion: "2.0.0",
  entryPointVersion: "0.7",
  validatorType: "ecdsa_secp256k1",
  accountMode: "factory",
  factoryVersion: "2.0.0",
  implementationVersion: "v1.0.0",
  address: "0x1111111111111111111111111111111111111111",
  ownerAddress: "0x2222222222222222222222222222222222222222",
  salt: "12345678901234567890",
};

describe("factory ECDSA wallet metadata", () => {
  it("round-trips deterministic reconstruction data without losing salt precision", () => {
    const decoded = Schema.decodeUnknownSync(AlchemyModularV2WalletData)(encoded);
    expect(decoded).toMatchObject({ salt: 12345678901234567890n });
    expect(Schema.encodeSync(AlchemyModularV2WalletData)(decoded)).toEqual(encoded);
  });

  it.each([
    { factoryVersion: "latest" },
    { implementationVersion: "v2.0.0" },
    { ownerAddress: undefined },
    { salt: "-1" },
    { salt: (1n << 256n).toString() },
    { accountMode: "7702" },
  ])("rejects incomplete, unsupported or ambiguous derivation: %j", (change) => {
    expect(() =>
      Schema.decodeUnknownSync(AlchemyModularV2WalletData)({ ...encoded, ...change }),
    ).toThrow();
  });
});
