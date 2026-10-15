import { Schema } from "effect";

import { CreateEvmSessionInstallation } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { usdcAllowanceRecipe } from "../../src/index.js";

const now = 1_800_000_000;
const expiresAt = new Date((now + 100 * 86_400) * 1000).toISOString();

describe("USDC lifetime allowance", () => {
  it("accepts exactly uint256 maximum but rejects one additional base unit", () => {
    const maximum = 2n ** 256n - 1n;
    const allowance = `${maximum / 1_000_000n}.${(maximum % 1_000_000n).toString().padStart(6, "0")}`;
    const overflow = `${(maximum + 1n) / 1_000_000n}.${((maximum + 1n) % 1_000_000n).toString().padStart(6, "0")}`;
    const input = { networks: ["eip155:1"], allowance, expiresAt } as const;
    const output = usdcAllowanceRecipe.build(input, { now });
    expect(output.onchain.installations[0]?.permissions).toMatchObject([{ allowance: maximum }]);
    expect(() => usdcAllowanceRecipe.build({ ...input, allowance: overflow }, { now })).toThrow();
  });

  it("builds independent exact allowances using each network's native USDC", () => {
    const output = usdcAllowanceRecipe.build(
      {
        networks: ["eip155:1", "eip155:8453"],
        allowance: "9007199254740993.123456",
        expiresAt,
      },
      { now },
    );

    expect(output.onchain.installations).toEqual(
      [
        { chainId: "eip155:1", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
        { chainId: "eip155:8453", address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" },
      ].map(({ chainId, address }) => ({
        chainId,
        validAfter: now,
        validUntil: now + 100 * 86_400,
        allowSignatures: false,
        permissions: [
          { type: "erc20-token-transfer", address, allowance: 9007199254740993123456n },
        ],
      })),
    );
    expect(output.policies).toEqual([]);
    for (const installation of output.onchain.installations)
      expect(Schema.is(CreateEvmSessionInstallation)(installation)).toBe(true);
  });

  it.each(["", "0", "-1", "1.0000001", "1e6", "NaN", "1.", "9".repeat(80)])(
    "rejects unsafe allowance %s without rounding",
    (allowance) => {
      expect(() =>
        usdcAllowanceRecipe.build(
          {
            networks: ["eip155:1"],
            allowance,
            expiresAt,
          },
          { now },
        ),
      ).toThrow();
    },
  );

  it("rejects empty, duplicate and unsupported networks", () => {
    const decode = Schema.decodeUnknownSync(usdcAllowanceRecipe.inputSchema);
    for (const networks of [[], ["eip155:1", "eip155:1"], ["eip155:999"]])
      expect(() => decode({ networks, allowance: "100", expiresAt })).toThrow();
  });

  it.each([
    "",
    "invalid",
    "2028-02-30T00:00:00Z",
    "2028-01-01",
    new Date(now * 1000).toISOString(),
    new Date((now - 1) * 1000).toISOString(),
  ])("rejects invalid or elapsed expiry %s", (invalidExpiry) => {
    expect(() =>
      usdcAllowanceRecipe.build(
        {
          networks: ["eip155:1"],
          allowance: "100",
          expiresAt: invalidExpiry,
        },
        { now },
      ),
    ).toThrow();
  });

  it("keeps the smallest unit and supported testnets isolated", () => {
    const output = usdcAllowanceRecipe.build(
      {
        networks: ["eip155:11155111"],
        allowance: "0.000001",
        expiresAt,
      },
      { now },
    );
    expect(output.onchain.installations[0]?.permissions).toEqual([
      {
        type: "erc20-token-transfer",
        address: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
        allowance: 1n,
      },
    ]);
  });

  it("preserves the chosen expiry instant without adding a relative duration", () => {
    const chosenExpiry = "2027-03-01T18:30:00Z";
    const output = usdcAllowanceRecipe.build(
      { networks: ["eip155:1"], allowance: "100", expiresAt: chosenExpiry },
      { now },
    );
    expect(output.onchain.installations[0]?.validUntil).toBe(Date.parse(chosenExpiry) / 1000);
  });
});
