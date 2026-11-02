import { Schema } from "effect";

import { CreateEvmSessionInstallation } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { ensRegistrationTemplate, getTemplate } from "../../src/index.js";

const now = 1_800_000_000;
const input = {
  networks: ["eip155:1", "eip155:11155111"],
  tokens: ["usdc", "dai"],
  allowFactoryDeployments: true,
  expiresAt: new Date((now + 86_400) * 1000).toISOString(),
} as const;

describe("ENSv2 registration", () => {
  it.each([true, false])(
    "builds exact registration permissions with factory deployments: %s",
    (allowFactoryDeployments) => {
      const output = ensRegistrationTemplate.build({ ...input, allowFactoryDeployments }, { now });
      const deployments = [
        [
          "eip155:1",
          "0xd6d8369e55c94ae8afa714e6cf7ab5be54d5cc81",
          [
            "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
            "0x6b175474e89094c44da98b954eedeac495271d0f",
          ],
        ],
        [
          "eip155:11155111",
          "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3",
          [
            "0x240b0316df57887dbbe58b586508b19e633a14aa",
            "0xf6fac8a58a0be13b9197f27c41b73162fe32572b",
          ],
        ],
      ] as const;

      expect(output).toEqual({
        onchain: {
          installations: deployments.map(([chainId, registrar, tokens]) => ({
            chainId,
            validAfter: now,
            validUntil: now + 86_400,
            allowSignatures: false,
            permissions: [
              {
                type: "functions-on-contract",
                address: registrar,
                functions: ["0xf14fcbc8", "0xcff3e7c2"],
              },
              ...tokens.map((address) => ({
                type: "functions-on-contract",
                address,
                functions: ["0x095ea7b3"],
              })),
              { type: "native-token-transfer", allowance: 0n },
              ...(allowFactoryDeployments
                ? [
                    {
                      type: "functions-on-contract",
                      address:
                        chainId === "eip155:1"
                          ? "0x77510ba162dfea3d8989e3f0928a691b345730d2"
                          : "0xda70306c98e97ece36f997a21368e53298572991",
                      functions: ["0x5d84121a"],
                    },
                  ]
                : []),
            ],
          })),
        },
        policies: [],
      });
      for (const installation of output.onchain.installations)
        expect(Schema.is(CreateEvmSessionInstallation)(installation)).toBe(true);

      expect(getTemplate("ens-registration")).toBe(ensRegistrationTemplate);
    },
  );

  it("does not grant unselected tokens or renewal", () => {
    const output = ensRegistrationTemplate.build(
      { ...input, networks: ["eip155:1"], tokens: ["usdc"], allowFactoryDeployments: false },
      { now },
    );

    expect(output.onchain.installations).toHaveLength(1);
    expect(output.onchain.installations[0]?.permissions).toHaveLength(3);
    expect(output.onchain.installations[0]?.permissions[1]).toEqual({
      type: "functions-on-contract",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      functions: ["0x095ea7b3"],
    });
  });

  it("defaults factory deployment on and requires an explicit boolean in submitted configuration", () => {
    expect(ensRegistrationTemplate.defaults.allowFactoryDeployments).toBe(true);
    expect(() =>
      Schema.decodeUnknownSync(ensRegistrationTemplate.inputSchema)({
        ...input,
        allowFactoryDeployments: undefined,
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(ensRegistrationTemplate.inputSchema)({
        ...input,
        allowFactoryDeployments: "false",
      }),
    ).toThrow();
  });

  it.each([
    { networks: ["eip155:8453"] },
    { tokens: ["circle-test-usdc"] },
    { expiresAt: new Date(now * 1000).toISOString() },
  ])("rejects unsupported or expired configuration: %j", (invalid) => {
    expect(() =>
      ensRegistrationTemplate.build(
        Schema.decodeUnknownSync(ensRegistrationTemplate.inputSchema)({ ...input, ...invalid }),
        { now },
      ),
    ).toThrow();
  });
});
