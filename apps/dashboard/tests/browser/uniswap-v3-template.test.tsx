// oxlint-disable react-perf/jsx-no-new-object-as-prop
import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { uniswapV3SwapsRecipe } from "@namera-ai/recipes";
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

const now = Math.floor(Date.now() / 1000);
const expiresAt = new Date((now + 86_400) * 1000).toISOString();
const wallets = [newestSessionAccount];
const onCreate = vi.fn();
const initialNetworks = ["eip155:8453", "eip155:421614"] as const;
const noNetworks: readonly never[] = [];

function TemplateHarness({ empty = false }: { empty?: boolean }) {
  const form = useForm<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>({
    defaultValues: createSessionKeyInitialValues(
      wallets,
      { initialAccountId: newestSessionAccount.id, recipe: uniswapV3SwapsRecipe },
      now,
    ),
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateSessionKeyFormSchema)),
  });
  const recipe = {
    ...uniswapV3SwapsRecipe,
    defaults: { networks: empty ? noNetworks : initialNetworks, expiresAt },
  };
  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <RecipeCreationForm
        recipe={recipe}
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

beforeEach(async () => {
  onCreate.mockReset();
  await page.viewport(1280, 960);
});

it("shows just the approval note and submits swap-only permissions", async () => {
  await render(<TemplateHarness />);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect
    .element(page.getByRole("button", { name: /Payment tokens/ }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole("note", { name: "Token approval" }))
    .toHaveTextContent(
      "Before swapping, approve the input token to the Uniswap router on the selected network.",
    );

  await expect
    .element(page.getByRole("button", { name: "Router addresses", exact: true }))
    .not.toBeInTheDocument();
  expect(onCreate).not.toHaveBeenCalled();

  await page.getByRole("button", { name: "Create session key", exact: true }).click();
  await expect.poll(() => onCreate.mock.calls.length).toBe(1);
  const submitted = onCreate.mock.calls[0]?.[0] as CreateSessionKeyFormValues;
  expect(submitted.metadata.logo).toEqual({ type: "emoji", value: "🦄" });
  expect(submitted.policies).toEqual([]);
  expect(submitted.onchain.installations).toEqual(
    [
      ["eip155:8453", "0x2626664c2603336e57b271c5c0b26f421741e481"],
      ["eip155:421614", "0x101f443b4d1b059569d643917553c771e1b9663e"],
    ].map(([chainId, address]) => ({
      chainId,
      validAfter: expect.any(Number),
      validUntil: now + 86_400,
      allowSignatures: false,
      permissions: [
        { type: "functions-on-contract", address, functions: ["0x04e45aaf", "0xb858183f"] },
        { type: "native-token-transfer", allowance: 0n },
      ],
    })),
  );
});

it("requires a network and preserves selection on a narrow screen", async () => {
  await page.viewport(375, 900);
  await render(<TemplateHarness empty />);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect
    .element(page.getByRole("button", { name: "Router addresses", exact: true }))
    .not.toBeInTheDocument();
  await page.getByRole("button", { name: "Create session key", exact: true }).click();
  await expect
    .element(page.getByText("Choose at least one network.", { exact: true }))
    .toBeVisible();
  expect(onCreate).not.toHaveBeenCalled();

  const networks = page.getByRole("button", { name: /Networks/ });
  await networks.click();
  await page.getByRole("option", { name: "Base", exact: true }).click();
  await userEvent.keyboard("{Escape}");
  await networks.click();
  await page.getByRole("option", { name: "Base", exact: true }).click();
  await page.getByRole("option", { name: "Ethereum", exact: true }).click();
  await userEvent.keyboard("{Escape}");
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  await page.getByRole("button", { name: "Back to details", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect.poll(() => networks.element().textContent).toContain("Ethereum");
  await page.getByRole("button", { name: "Create session key", exact: true }).click();
  await expect.poll(() => onCreate.mock.calls.length).toBe(1);
  expect(onCreate.mock.calls[0]?.[0].onchain.installations[0].chainId).toBe("eip155:1");
});
