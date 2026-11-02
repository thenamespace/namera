// oxlint-disable react-perf/jsx-no-new-object-as-prop
import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { uniswapV3LiquidityTemplate } from "@namera-ai/templates";
import { useForm } from "react-hook-form";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { createSessionKeyInitialValues } from "../../src/components/session-key-creation/initial-values";
import { CreateSessionKeyFormSchema } from "../../src/components/session-key-creation/schema";
import { TemplateCreationForm } from "../../src/components/session-key-creation/template-form";
import type {
  CreateSessionKeyFormInput,
  CreateSessionKeyFormValues,
} from "../../src/components/session-key-creation/types";
import { newestSessionAccount } from "../fixtures/session-key-preset";

vi.mock("../../src/env", () => ({
  env: { backendUrl: "https://api.example.test", environment: "test" },
}));

const now = Math.floor(Date.now() / 1000);
const expiresAt = new Date((now + 86_400) * 1000).toISOString();
const wallets = [newestSessionAccount];
const onCreate = vi.fn();
const template = {
  ...uniswapV3LiquidityTemplate,
  defaults: {
    ...uniswapV3LiquidityTemplate.defaults,
    networks: ["eip155:1", "eip155:11155420"] as const,
    expiresAt,
  },
};
const operations = [
  ["Create positions", "Create a liquidity position in an existing pool."],
  ["Add liquidity", "Deposit approved tokens into a position."],
  ["Remove liquidity", "Reduce liquidity; collect proceeds separately."],
  ["Collect proceeds", "Claim fees and previously withdrawn tokens."],
] as const;

function TemplateHarness() {
  const form = useForm<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>({
    defaultValues: createSessionKeyInitialValues(
      wallets,
      { initialAccountId: newestSessionAccount.id, template: uniswapV3LiquidityTemplate },
      now,
    ),
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateSessionKeyFormSchema)),
  });
  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <TemplateCreationForm
        template={template}
        metadataForm={form}
        wallets={wallets}
        limits={{ local: false, managed: false }}
        custodyLocked={false}
        disabled={false}
        onCreate={onCreate}
      />
    </div>
  );
}

async function openConfiguration() {
  await render(<TemplateHarness />);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

beforeEach(async () => {
  onCreate.mockReset();
  await page.viewport(1280, 960);
});

it.each([false, true])(
  "submits the exact position-manager scope with full access: %s",
  async (fullAccess) => {
    await openConfiguration();
    await Promise.all(
      operations
        .slice(0, 3)
        .map(([label]) =>
          expect
            .element(page.getByRole("checkbox", { name: label, exact: true }))
            .not.toBeChecked(),
        ),
    );
    await expect
      .element(page.getByRole("checkbox", { name: "Collect proceeds", exact: true }))
      .toBeChecked();
    await expect
      .element(page.getByRole("note", { name: "Token approval" }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: /Payment tokens/ }))
      .not.toBeInTheDocument();

    if (fullAccess) {
      page
        .getByRole("button", { name: /Networks/ })
        .element()
        .focus();
      await userEvent.keyboard("{Tab}");
      // Keyboard focus and checkbox interactions must run in order.
      /* oxlint-disable no-await-in-loop */
      for (const [index, [label, tooltip]] of operations.entries()) {
        const information = page.getByRole("button", { name: `${label} information`, exact: true });
        await expect.element(information).toHaveFocus();
        await expect.element(page.getByRole("tooltip")).toHaveTextContent(tooltip);
        await userEvent.keyboard("{Escape}");
        if (index < operations.length - 1) await userEvent.keyboard("{Tab}{Tab}");
      }
      for (const [label] of operations.slice(0, 3))
        await page.getByText(label, { exact: true }).click();
      /* oxlint-enable no-await-in-loop */
      await expect
        .element(page.getByRole("note", { name: "Token approval" }))
        .toHaveTextContent(
          "Before adding liquidity, approve the input tokens to the Uniswap position manager on the selected network.",
        );
    }

    expect(onCreate).not.toHaveBeenCalled();
    await page.getByRole("button", { name: "Create session key", exact: true }).click();
    await expect.poll(() => onCreate.mock.calls.length).toBe(1);
    const submitted = onCreate.mock.calls[0]?.[0] as CreateSessionKeyFormValues;
    expect(submitted.metadata.logo).toEqual({ type: "emoji", value: "🦄" });
    expect(submitted.policies).toEqual([]);
    expect(submitted.onchain.installations).toEqual(
      [
        ["eip155:1", "0xc36442b4a4522e871399cd717abdd847ab11fe88"],
        ["eip155:11155420", "0xda75cef1c93078e8b736fca5d5a30adb97c8957d"],
      ].map(([chainId, address]) => ({
        chainId,
        validAfter: expect.any(Number),
        validUntil: now + 86_400,
        allowSignatures: false,
        permissions: [
          {
            type: "functions-on-contract",
            address,
            functions: fullAccess
              ? ["0x88316456", "0x219f5d17", "0x0c49ccbe", "0xfc6f7865"]
              : ["0xfc6f7865"],
          },
          { type: "native-token-transfer", allowance: 0n },
        ],
      })),
    );
  },
);

it("requires an operation and toggles the approval note while preserving edits on mobile", async () => {
  await page.viewport(375, 900);
  await openConfiguration();
  await page.getByText("Collect proceeds", { exact: true }).click();
  await page.getByRole("button", { name: "Create session key", exact: true }).click();
  await expect
    .element(page.getByText("Choose at least one operation.", { exact: true }))
    .toBeVisible();
  expect(onCreate).not.toHaveBeenCalled();

  await page.getByText("Add liquidity", { exact: true }).click();
  await expect.element(page.getByRole("note", { name: "Token approval" })).toBeVisible();
  await page.getByText("Add liquidity", { exact: true }).click();
  await expect.element(page.getByRole("note", { name: "Token approval" })).not.toBeInTheDocument();
  await page.getByText("Create positions", { exact: true }).click();
  await expect.element(page.getByRole("note", { name: "Token approval" })).toBeVisible();
  await page.getByRole("button", { name: "Back to details", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect
    .element(page.getByRole("checkbox", { name: "Create positions", exact: true }))
    .toBeChecked();
  await expect
    .element(page.getByRole("checkbox", { name: "Collect proceeds", exact: true }))
    .not.toBeChecked();
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  await page.getByRole("button", { name: "Create session key", exact: true }).click();
  await expect.poll(() => onCreate.mock.calls.length).toBe(1);
  expect(onCreate.mock.calls[0]?.[0].onchain.installations[0].permissions).toEqual([
    {
      type: "functions-on-contract",
      address: "0xc36442b4a4522e871399cd717abdd847ab11fe88",
      functions: ["0x88316456"],
    },
    { type: "native-token-transfer", allowance: 0n },
  ]);
});
