import { expect, it } from "@effect/vitest";

import { chains } from "../../src/index.js";

const launchChains = [
  ["arbitrum-mainnet", 42161, "arb-mainnet", false],
  ["arbitrum-sepolia", 421614, "arb-sepolia", true],
  ["base-mainnet", 8453, "base-mainnet", false],
  ["base-sepolia", 84532, "base-sepolia", true],
  ["ethereum-mainnet", 1, "eth-mainnet", false],
  ["ethereum-sepolia", 11155111, "eth-sepolia", true],
  ["optimism-mainnet", 10, "opt-mainnet", false],
  ["optimism-sepolia", 11155420, "opt-sepolia", true],
] as const;

it("exposes only the eight launch networks", () => {
  expect(
    Object.entries(chains).map(([key, data]) => [
      key,
      data.chain.id,
      data.alchemyChain,
      data.chain.testnet ?? false,
    ]),
  ).toEqual(launchChains);
  expect(Object.values(chains).every(({ operationsEnabled }) => operationsEnabled)).toBe(true);
});
