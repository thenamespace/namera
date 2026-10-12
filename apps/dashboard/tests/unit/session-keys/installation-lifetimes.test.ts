import { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { expect, it } from "vitest";

import { groupInstallationLifetimes } from "../../../src/routes/_authenticated/session-key/-components/installation-lifetimes";

it("keeps different authorization lifetimes scoped to their networks", () => {
  const ethereum = SupportedEvmChainId.make("eip155:1");
  const base = SupportedEvmChainId.make("eip155:8453");
  const arbitrum = SupportedEvmChainId.make("eip155:42161");
  const authorization = { validAfter: 0, validUntil: 200 };
  const groups = groupInstallationLifetimes([
    { chainId: ethereum, authorization },
    { chainId: base, authorization },
    { chainId: ethereum, authorization },
    { chainId: arbitrum, authorization: { validAfter: 100, validUntil: 300 } },
  ]);
  expect([...groups.values()]).toEqual([
    { ...authorization, chainIds: [ethereum, base] },
    { validAfter: 100, validUntil: 300, chainIds: [arbitrum] },
  ]);
  expect(groupInstallationLifetimes([]).size).toBe(0);
});
