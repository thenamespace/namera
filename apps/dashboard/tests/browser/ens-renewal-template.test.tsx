// oxlint-disable react-perf/jsx-no-new-object-as-prop
import type { ComponentProps } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { ensRenewalRecipe, usdcAllowanceRecipe } from "@namera-ai/recipes";
import { useForm } from "react-hook-form";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { createSessionKeyInitialValues } from "../../src/components/session-key-creation/initial-values";
import { RecipeCreationForm } from "../../src/components/session-key-creation/recipe-form";
import { CreateSessionKeyFormSchema } from "../../src/components/session-key-creation/schema";
import type {
  CreateSessionKeyFormInput,
  CreateSessionKeyFormValues,
} from "../../src/components/session-key-creation/types";
import { newestSessionAccount } from "../fixtures/session-key-preset";

vi.mock("../../src/env", () => ({
  env: { backendUrl: "https://api.example.test", environment: "test" },
}));

type Template = ComponentProps<typeof RecipeCreationForm>["recipe"];
const now = Math.floor(Date.now() / 1000);
const expiresAt = new Date((now + 86_400) * 1000).toISOString();
const ensTemplate: Template = {
  ...ensRenewalRecipe,
  defaults: {
    ...ensRenewalRecipe.defaults,
    networks: ["eip155:1", "eip155:11155111"],
    expiresAt,
  },
};
const onCreate = vi.fn();
const wallets = [newestSessionAccount];

function TemplateHarness({
  recipe = ensTemplate,
  disabled = false,
}: {
  recipe?: Template;
  disabled?: boolean;
}) {
  const form = useForm<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>({
    defaultValues: {
      ...createSessionKeyInitialValues(
        wallets,
        { initialAccountId: newestSessionAccount.id, recipe: ensRenewalRecipe },
        now,
      ),
      metadata: { version: 1, name: "Renewal agent", logo: { type: "emoji", value: "🔑" } },
    },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateSessionKeyFormSchema)),
  });

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <RecipeCreationForm
        recipe={recipe}
        metadataForm={form}
        wallets={wallets}
        limits={{ local: false, managed: false }}
        custodyLocked={false}
        disabled={disabled}
        onCreate={onCreate}
      />
    </div>
  );
}

beforeEach(async () => {
  onCreate.mockReset();
  await page.viewport(1280, 960);
});

it("submits only the selected payment-token approvals on both networks", async () => {
  await render(<TemplateHarness />);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect.element(page.getByText("Approval access", { exact: true })).toBeVisible();
  await expect.element(page.getByText(/There is no spending budget/)).toBeVisible();

  const tokens = page.getByRole("button", { name: /Payment tokens/ });
  await tokens.click();
  await page.getByRole("option", { name: /^USDC/ }).click();
  await userEvent.keyboard("{Escape}");
  await expect.element(tokens).toHaveTextContent("DAI");
  await page.getByRole("button", { name: "Create session key", exact: true }).click();

  await expect.poll(() => onCreate.mock.calls.length).toBe(1);
  const submitted = onCreate.mock.calls[0]?.[0] as CreateSessionKeyFormValues;
  expect(
    submitted.onchain.installations.map(({ chainId, permissions, allowSignatures }) => ({
      chainId,
      permissions,
      allowSignatures,
    })),
  ).toEqual([
    {
      chainId: "eip155:1",
      allowSignatures: false,
      permissions: [
        {
          type: "functions-on-contract",
          address: "0xd6d8369e55c94ae8afa714e6cf7ab5be54d5cc81",
          functions: ["0x2d06649b"],
        },
        {
          type: "functions-on-contract",
          address: "0x6b175474e89094c44da98b954eedeac495271d0f",
          functions: ["0x095ea7b3"],
        },
        { type: "native-token-transfer", allowance: 0n },
      ],
    },
    {
      chainId: "eip155:11155111",
      allowSignatures: false,
      permissions: [
        {
          type: "functions-on-contract",
          address: "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3",
          functions: ["0x2d06649b"],
        },
        {
          type: "functions-on-contract",
          address: "0xf6fac8a58a0be13b9197f27c41b73162fe32572b",
          functions: ["0x095ea7b3"],
        },
        { type: "native-token-transfer", allowance: 0n },
      ],
    },
  ]);
  expect(submitted.policies).toEqual([]);
});

it("validates empty token selection and supports keyboard recovery on a narrow screen", async () => {
  await page.viewport(375, 900);
  await render(<TemplateHarness />);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  const tokens = page.getByRole("button", { name: /Payment tokens/ });
  await tokens.click();
  await page.getByRole("option", { name: /^USDC/ }).click();
  await page.getByRole("option", { name: /^DAI/ }).click();
  await userEvent.keyboard("{Escape}");
  await page.getByRole("button", { name: "Create session key", exact: true }).click();
  await expect
    .element(page.getByText("Choose at least one payment token.", { exact: true }))
    .toBeVisible();
  expect(onCreate).not.toHaveBeenCalled();

  tokens.element().focus();
  await userEvent.keyboard("{ArrowDown}");
  await expect.element(page.getByRole("listbox")).toBeVisible();
  const usdc = page.getByRole("option", { name: /^USDC/ });
  usdc.element().focus();
  await expect.element(usdc).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect.element(usdc).toHaveAttribute("aria-selected", "true");
  await userEvent.keyboard("{Escape}");
  await expect.element(tokens).toHaveTextContent("USDC");
  await page.getByRole("button", { name: "Back to details", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect.element(tokens).toHaveTextContent("USDC");
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  await page.getByRole("button", { name: "Create session key", exact: true }).click();
  await expect.poll(() => onCreate.mock.calls.length).toBe(1);
});

it("preserves the existing USDC allowance form and its exact budget", async () => {
  const recipe: Template = {
    ...usdcAllowanceRecipe,
    defaults: { networks: ["eip155:1"], allowance: "100.000001", expiresAt },
  };
  await render(<TemplateHarness recipe={recipe} />);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect
    .element(page.getByRole("button", { name: /Payment tokens/ }))
    .not.toBeInTheDocument();
  await page.getByRole("button", { name: "Create session key", exact: true }).click();
  await expect.poll(() => onCreate.mock.calls.length).toBe(1);
  expect(onCreate.mock.calls[0]?.[0].onchain.installations[0].permissions).toEqual([
    {
      type: "erc20-token-transfer",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      allowance: 100_000_001n,
    },
  ]);
});

it("keeps a disabled template from advancing or submitting", async () => {
  await render(<TemplateHarness disabled />);
  await expect.element(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
  expect(onCreate).not.toHaveBeenCalled();
});
