import { Schema } from "effect";

import { CreateEvmSessionInstallation } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { ensSubnameIssuerRecipe, getRecipe } from "../../src/index.js";

const now = 1_800_000_000;
const registry = "0x2222222222222222222222222222222222222222";
const input = {
  networks: ["eip155:11155111"],
  subregistryAddress: registry,
  expiresAt: new Date((now + 86_400) * 1000).toISOString(),
};

describe("ENSv2 subname issuer", () => {
  it.each(["eip155:1", "eip155:11155111"])(
    "grants only register on the chosen registry on %s",
    (chainId) => {
      const output = ensSubnameIssuerRecipe.build({ ...input, networks: [chainId] }, { now });

      expect(output).toEqual({
        onchain: {
          installations: [
            {
              chainId,
              validAfter: now,
              validUntil: now + 86_400,
              allowSignatures: false,
              permissions: [
                { type: "functions-on-contract", address: registry, functions: ["0x85f3e643"] },
                { type: "native-token-transfer", allowance: 0n },
              ],
            },
          ],
        },
        policies: [],
      });
      expect(Schema.is(CreateEvmSessionInstallation)(output.onchain.installations[0])).toBe(true);
      expect(getRecipe("ens-subname-issuer")).toBe(ensSubnameIssuerRecipe);
    },
  );

  it.each([
    { networks: [] },
    { networks: ["eip155:8453"] },
    { networks: ["eip155:1", "eip155:11155111"] },
    { subregistryAddress: "" },
    { subregistryAddress: "0x123" },
    { subregistryAddress: `0x${"0".repeat(40)}` },
    { expiresAt: new Date(now * 1000).toISOString() },
  ])("rejects invalid registry configuration: %j", (invalid) => {
    expect(() => ensSubnameIssuerRecipe.build({ ...input, ...invalid }, { now })).toThrow();
  });
});
