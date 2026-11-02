import { Schema } from "effect";

import { CreateEvmSessionInstallation } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { getTemplate, uniswapV3LiquidityTemplate } from "../../src/index.js";

const now = 1_800_000_000;
const input = {
  ...uniswapV3LiquidityTemplate.defaults,
  networks: ["eip155:1"],
  expiresAt: new Date((now + 86_400) * 1000).toISOString(),
} as const;
const managers = [
  ["eip155:1", "0xc36442b4a4522e871399cd717abdd847ab11fe88"],
  ["eip155:10", "0xc36442b4a4522e871399cd717abdd847ab11fe88"],
  ["eip155:8453", "0x03a520b32c04bf3beef7beb72e919cf822ed34f1"],
  ["eip155:42161", "0xc36442b4a4522e871399cd717abdd847ab11fe88"],
  ["eip155:11155111", "0x1238536071e1c677a632429e3655c799b22cda52"],
  ["eip155:11155420", "0xda75cef1c93078e8b736fca5d5a30adb97c8957d"],
  ["eip155:84532", "0x27f971cb582bf9e50f397e4d29a5c7a34f11faa2"],
  ["eip155:421614", "0x6b2937bde17889edcf8fbd8de31c3c2a70bc4d65"],
] as const;

describe("Uniswap v3 liquidity manager", () => {
  it("defaults to collect-only permissions on all eight reviewed position managers", () => {
    const output = uniswapV3LiquidityTemplate.build(
      { ...input, networks: managers.map(([chainId]) => chainId) },
      { now },
    );
    expect(output).toEqual({
      onchain: {
        installations: managers.map(([chainId, address]) => ({
          chainId,
          validAfter: now,
          validUntil: now + 86_400,
          allowSignatures: false,
          permissions: [
            { type: "functions-on-contract", address, functions: ["0xfc6f7865"] },
            { type: "native-token-transfer", allowance: 0n },
          ],
        })),
      },
      policies: [],
    });
    for (const installation of output.onchain.installations)
      expect(Schema.is(CreateEvmSessionInstallation)(installation)).toBe(true);
    expect(getTemplate("uniswap-v3-liquidity")).toBe(uniswapV3LiquidityTemplate);
  });

  it.each([
    [{ createPositions: true, collectProceeds: false }, ["0x88316456"]],
    [{ addLiquidity: true, collectProceeds: false }, ["0x219f5d17"]],
    [{ removeLiquidity: true, collectProceeds: false }, ["0x0c49ccbe"]],
    [{ removeLiquidity: true }, ["0x0c49ccbe", "0xfc6f7865"]],
    [
      { createPositions: true, addLiquidity: true, removeLiquidity: true },
      ["0x88316456", "0x219f5d17", "0x0c49ccbe", "0xfc6f7865"],
    ],
  ])("grants exactly the selected operations: %j", (operations, functions) => {
    const output = uniswapV3LiquidityTemplate.build({ ...input, ...operations }, { now });
    expect(output.onchain.installations).toHaveLength(1);
    expect(output.onchain.installations[0]?.permissions).toEqual([
      {
        type: "functions-on-contract",
        address: "0xc36442b4a4522e871399cd717abdd847ab11fe88",
        functions,
      },
      { type: "native-token-transfer", allowance: 0n },
    ]);
  });

  it.each([
    { collectProceeds: false },
    { networks: [] },
    { networks: ["eip155:1", "eip155:1"] },
    { networks: ["eip155:5042"] },
    { createPositions: "true" },
    { collectProceeds: undefined },
    { expiresAt: "invalid" },
    { expiresAt: new Date(now * 1000).toISOString() },
  ])("rejects empty operations and invalid configuration: %j", (invalid) => {
    expect(() =>
      uniswapV3LiquidityTemplate.build(
        Schema.decodeUnknownSync(uniswapV3LiquidityTemplate.inputSchema)({ ...input, ...invalid }),
        { now },
      ),
    ).toThrow();
  });
});
