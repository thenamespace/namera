import { Schema } from "effect";

import { CreateEvmSessionInstallation } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { getRecipe, uniswapV3SwapsRecipe } from "../../src/index.js";

const now = 1_800_000_000;
const expiresAt = new Date((now + 86_400) * 1000).toISOString();
const deployments = [
  ["eip155:1", "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45"],
  ["eip155:10", "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45"],
  ["eip155:8453", "0x2626664c2603336e57b271c5c0b26f421741e481"],
  ["eip155:42161", "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45"],
  ["eip155:11155111", "0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e"],
  ["eip155:11155420", "0x94cc0aac535ccdb3c01d6787d6413c739ae12bc4"],
  ["eip155:84532", "0x94cc0aac535ccdb3c01d6787d6413c739ae12bc4"],
  ["eip155:421614", "0x101f443b4d1b059569d643917553c771e1b9663e"],
] as const;

describe("Uniswap v3 swaps", () => {
  it("grants only v3 exact-input swaps with zero native value on all eight routers", () => {
    const output = uniswapV3SwapsRecipe.build(
      { networks: deployments.map(([chainId]) => chainId), expiresAt },
      { now },
    );

    expect(output).toEqual({
      onchain: {
        installations: deployments.map(([chainId, address]) => ({
          chainId,
          validAfter: now,
          validUntil: now + 86_400,
          allowSignatures: false,
          permissions: [
            { type: "functions-on-contract", address, functions: ["0x04e45aaf", "0xb858183f"] },
            { type: "native-token-transfer", allowance: 0n },
          ],
        })),
      },
      policies: [],
    });
    for (const installation of output.onchain.installations)
      expect(Schema.is(CreateEvmSessionInstallation)(installation)).toBe(true);
    expect(getRecipe("uniswap-v3-swaps")).toBe(uniswapV3SwapsRecipe);
    expect(uniswapV3SwapsRecipe.approval.spenders).toEqual(
      deployments.map(([chainId, address]) => ({ chainId, address })),
    );
  });

  it("creates only the selected installations without token approval permissions", () => {
    const output = uniswapV3SwapsRecipe.build({ networks: ["eip155:8453"], expiresAt }, { now });
    expect(output.onchain.installations).toHaveLength(1);
    expect(output.onchain.installations[0]?.permissions).toEqual([
      {
        type: "functions-on-contract",
        address: "0x2626664c2603336e57b271c5c0b26f421741e481",
        functions: ["0x04e45aaf", "0xb858183f"],
      },
      { type: "native-token-transfer", allowance: 0n },
    ]);
  });

  it.each([
    { networks: [] },
    { networks: ["eip155:5042"] },
    { networks: ["eip155:1", "eip155:1"] },
    { expiresAt: "not-a-date" },
    { expiresAt: new Date(now * 1000).toISOString() },
  ])("rejects invalid configuration: %j", (invalid) => {
    expect(() =>
      uniswapV3SwapsRecipe.build({ networks: ["eip155:1"], expiresAt, ...invalid }, { now }),
    ).toThrow();
  });
});
