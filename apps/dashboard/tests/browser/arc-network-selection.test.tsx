import { useState } from "react";

import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { EvmChainSelect } from "../../src/components/evm-chain-select";
import { EvmNetworkMultiSelect } from "../../src/components/policy/evm/network-multi-select";
import { OnchainPermissionEditor } from "../../src/components/policy/evm/onchain/editor";

vi.mock("../../src/env", () => ({ env: { backendUrl: "https://api.example.test" } }));

const arcChainIds = ["eip155:5042", "eip155:5042002"] as const;
const arcMainnet = ["eip155:5042"] as const;
const noop = () => undefined;

function ChainPicker() {
  const [chainId, setChainId] = useState<SupportedEvmChainId | null>(null);
  return (
    <>
      <span id="chain-label">Transaction network</span>
      <EvmChainSelect
        aria-labelledby="chain-label"
        chainIds={arcChainIds}
        value={chainId}
        onChange={setChainId}
      />
      <output aria-label="Selected chain">{chainId}</output>
    </>
  );
}

function NetworkPicker() {
  const [chainIds, setChainIds] = useState<ReadonlyArray<SupportedEvmChainId>>([]);
  return (
    <>
      <span id="networks-label">Session networks</span>
      <EvmNetworkMultiSelect
        aria-labelledby="networks-label"
        name="networks"
        value={chainIds}
        onChange={setChainIds}
        onBlur={noop}
        triggerRef={undefined}
        operationalOnly
      />
      <output aria-label="Selected networks">{chainIds.join(",")}</output>
    </>
  );
}

it("selects Arc mainnet and testnet in the shared transaction picker", async () => {
  await render(<ChainPicker />);
  await page.getByRole("button", { name: /Transaction network/ }).click();
  await page.getByRole("option", { name: "Arc", exact: true }).click();
  await expect
    .element(page.getByRole("status", { name: "Selected chain" }))
    .toHaveTextContent("eip155:5042");
  await page.getByRole("button", { name: /Transaction network/ }).click();
  await page.getByRole("option", { name: "Arc Testnet", exact: true }).click();
  await expect
    .element(page.getByRole("status", { name: "Selected chain" }))
    .toHaveTextContent("eip155:5042002");
});

it("offers both Arc networks in the shared session and signature allowlist picker", async () => {
  await render(<NetworkPicker />);
  await page.getByRole("button", { name: /Session networks/ }).click();
  await page.getByRole("option", { name: "Arc", exact: true }).click();
  await page.getByRole("option", { name: "Arc Testnet", exact: true }).click();
  await expect
    .element(page.getByRole("status", { name: "Selected networks" }))
    .toHaveTextContent("eip155:5042,eip155:5042002");
});

it("explains native USDC units when editing an Arc spending limit", async () => {
  await render(
    <OnchainPermissionEditor chainIds={arcMainnet} type="native-token-transfer" onSave={noop} />,
  );
  await expect.element(page.getByText(/0\.01 USDC is 10000000000000000/)).toBeVisible();
});
