import { Schema } from "effect";

import { CreateEvmSessionInstallation } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { ensRenewalTemplate, getTemplate } from "../../src/index.js";

const now = 1_800_000_000;
const expiresAt = new Date((now + 86_400) * 1000).toISOString();
const input = {
  networks: ["eip155:1", "eip155:11155111"],
  tokens: ["usdc", "dai"],
  expiresAt,
} as const;

describe("ENSv2 renewal", () => {
  it("grants only renew and approvals on the four reviewed token deployments", () => {
    const output = ensRenewalTemplate.build(input, { now });
    const expectedDeployments = [
      {
        chainId: "eip155:1",
        registrar: "0xd6d8369e55c94ae8afa714e6cf7ab5be54d5cc81",
        tokens: [
          "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          "0x6b175474e89094c44da98b954eedeac495271d0f",
        ],
      },
      {
        chainId: "eip155:11155111",
        registrar: "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3",
        tokens: [
          "0x240b0316df57887dbbe58b586508b19e633a14aa",
          "0xf6fac8a58a0be13b9197f27c41b73162fe32572b",
        ],
      },
    ];

    expect(output).toEqual({
      onchain: {
        installations: expectedDeployments.map(({ chainId, registrar, tokens }) => ({
          chainId,
          validAfter: now,
          validUntil: now + 86_400,
          allowSignatures: false,
          permissions: [
            { type: "functions-on-contract", address: registrar, functions: ["0x2d06649b"] },
            ...tokens.map((address) => ({
              type: "functions-on-contract",
              address,
              functions: ["0x095ea7b3"],
            })),
            { type: "native-token-transfer", allowance: 0n },
          ],
        })),
      },
      policies: [],
    });
    for (const installation of output.onchain.installations)
      expect(Schema.is(CreateEvmSessionInstallation)(installation)).toBe(true);

    expect(getTemplate("ens-renewal")).toBe(ensRenewalTemplate);
  });

  it.each([
    ["usdc", "0x240b0316df57887dbbe58b586508b19e633a14aa"],
    ["dai", "0xf6fac8a58a0be13b9197f27c41b73162fe32572b"],
  ] as const)("limits Sepolia approvals to the selected %s mock token", (token, address) => {
    const output = ensRenewalTemplate.build(
      { ...input, networks: ["eip155:11155111"], tokens: [token] },
      { now },
    );

    expect(output.onchain.installations).toHaveLength(1);
    expect(output.onchain.installations[0]?.permissions).toEqual([
      {
        type: "functions-on-contract",
        address: "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3",
        functions: ["0x2d06649b"],
      },
      { type: "functions-on-contract", address, functions: ["0x095ea7b3"] },
      { type: "native-token-transfer", allowance: 0n },
    ]);
  });

  it.each([
    { networks: [] },
    { networks: ["eip155:1", "eip155:1"] },
    { networks: ["eip155:8453"] },
    { tokens: [] },
    { tokens: ["usdc", "usdc"] },
    { tokens: ["circle-test-usdc"] },
    { tokens: ["0x1c7d4b196cb0c7b01d743fbc6116a902379c7238"] },
  ])("rejects invalid authority inputs: %j", (invalid) => {
    expect(() =>
      Schema.decodeUnknownSync(ensRenewalTemplate.inputSchema)({ ...input, ...invalid }),
    ).toThrow();
  });

  it.each([
    "",
    "2028-02-30T00:00:00Z",
    "2028-01-01",
    new Date(now * 1000).toISOString(),
    new Date((now - 1) * 1000).toISOString(),
    new Date((now + 0.5) * 1000).toISOString(),
  ])("rejects invalid or elapsed expiry %s", (expiry) => {
    expect(() => ensRenewalTemplate.build({ ...input, expiresAt: expiry }, { now })).toThrow();
  });
});
