// oxlint-disable react-perf/jsx-no-new-object-as-prop
import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { ensSubnameIssuerRecipe } from "@namera-ai/recipes";
import { useForm } from "react-hook-form";
import { encodeAbiParameters } from "viem";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

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
const registry = "0x2222222222222222222222222222222222222222";
const recipe = {
  ...ensSubnameIssuerRecipe,
  defaults: {
    networks: ["eip155:11155111"] as const,
    subregistryAddress: registry,
    expiresAt: new Date((now + 86_400) * 1000).toISOString(),
  },
};
const wallets = [newestSessionAccount];
const onCreate = vi.fn();

function TemplateHarness() {
  const form = useForm<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>({
    defaultValues: createSessionKeyInitialValues(
      wallets,
      { initialAccountId: newestSessionAccount.id, recipe: ensSubnameIssuerRecipe },
      now,
    ),
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
        disabled={false}
        onCreate={onCreate}
      />
    </div>
  );
}

function registryRpc(options: { code?: string; supports?: boolean; roles?: bigint } = {}) {
  return vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
    const request = JSON.parse(String(init?.body)) as {
      id: number;
      method: string;
      params?: [{ data: string; to: string }, string];
    };
    expect(String(input)).toMatch(/^https:\/\/api\.example\.test\/rpc\/eip155\/(1|11155111)$/);
    let result: string;
    if (request.method === "eth_blockNumber") result = "0x123";
    else if (request.method === "eth_getCode") result = options.code ?? "0x6000";
    else if (request.method === "eth_call") {
      expect(request.params?.[0].to).toBe(registry);
      expect(request.params?.[1]).toBe("0x123");
      result = request.params?.[0].data.startsWith("0x01ffc9a7")
        ? encodeAbiParameters([{ type: "bool" }], [options.supports ?? true])
        : encodeAbiParameters([{ type: "uint256" }], [options.roles ?? 1n]);
    } else throw new Error(`Unexpected RPC method: ${request.method}`);
    return Response.json({ jsonrpc: "2.0", id: request.id, result });
  });
}

async function openConfiguration() {
  await render(<TemplateHarness />);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect
    .element(
      page.getByText("Your account must already have the registrar role on this ENSv2 registry.", {
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
}

beforeEach(async () => {
  onCreate.mockReset();
  await page.viewport(1280, 960);
});

it("checks the registry/account then creates register-only permissions", async () => {
  const rpc = registryRpc();
  await openConfiguration();
  await expect
    .element(page.getByRole("button", { name: /Payment tokens/ }))
    .not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: /Network/ })).toHaveTextContent("Sepolia");
  await page.getByRole("button", { name: "Create session key", exact: true }).click();

  await expect.poll(() => onCreate.mock.calls.length).toBe(1);
  const submitted = onCreate.mock.calls[0]?.[0] as CreateSessionKeyFormValues;
  expect(submitted.metadata.logo).toEqual({ type: "emoji", value: "🌱" });
  expect(submitted.onchain.installations).toEqual([
    {
      chainId: "eip155:11155111",
      validAfter: expect.any(Number),
      validUntil: now + 86_400,
      allowSignatures: false,
      permissions: [
        { type: "functions-on-contract", address: registry, functions: ["0x85f3e643"] },
        { type: "native-token-transfer", allowance: 0n },
      ],
    },
  ]);
  expect(rpc).toHaveBeenCalledTimes(4);
  const rolesRequest = JSON.parse(String(rpc.mock.calls[3]?.[1]?.body)) as {
    params: [{ data: string }];
  };
  expect(rolesRequest.params[0].data.slice(-40)).toBe(newestSessionAccount.address.slice(2));
  rpc.mockClear();
});

it.each([
  [{ code: "0x" }, "No contract is deployed at this address on the selected network."],
  [{ supports: false }, "Enter an ENSv2 permissioned registry address."],
  [{ roles: 2n }, "This account does not have the registrar role on this registry."],
] as const)("blocks creation with inline registry feedback: %s", async (options, message) => {
  const rpc = registryRpc(options);
  await openConfiguration();
  await page.getByRole("button", { name: "Create session key", exact: true }).click();
  await expect.element(page.getByText(message, { exact: true })).toBeVisible();
  expect(onCreate).not.toHaveBeenCalled();
  await expect.element(page.getByRole("textbox", { name: /Registry address/ })).toHaveFocus();
  expect(rpc).toHaveBeenCalled();
  rpc.mockClear();
});

it("allows retry after an RPC failure and checks the newly selected network", async () => {
  await page.viewport(375, 900);
  const rpc = vi.mocked(globalThis.fetch).mockRejectedValue(new Error("RPC offline"));
  await openConfiguration();
  await page.getByRole("button", { name: "Create session key", exact: true }).click();
  await expect
    .element(
      page.getByText("Couldn’t check this registry. Check your connection and try again.", {
        exact: true,
      }),
    )
    .toBeVisible();
  expect(onCreate).not.toHaveBeenCalled();
  rpc.mockClear();

  registryRpc();
  await page.getByRole("button", { name: /Network/ }).click();
  await page.getByRole("option", { name: "Ethereum", exact: true }).click();
  await page.getByRole("button", { name: "Create session key", exact: true }).click();
  await expect.poll(() => onCreate.mock.calls.length).toBe(1);
  expect(onCreate.mock.calls[0]?.[0].onchain.installations[0].chainId).toBe("eip155:1");
  expect(rpc.mock.calls.every(([url]) => String(url).endsWith("/rpc/eip155/1"))).toBe(true);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  rpc.mockClear();
});

it("rejects malformed addresses before sending RPC requests", async () => {
  await openConfiguration();
  await page.getByRole("textbox", { name: /Registry address/ }).fill("0x123");
  await page.getByRole("button", { name: "Create session key", exact: true }).click();
  expect(onCreate).not.toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

it("locks the reviewed inputs while the registry check is pending", async () => {
  let resolveBlock!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    resolveBlock = resolve;
  });
  const rpc = registryRpc().mockImplementationOnce(() => pending);
  await openConfiguration();
  await page.getByRole("button", { name: "Create session key", exact: true }).click();

  await expect
    .element(page.getByRole("button", { name: "Checking registry…", exact: true }))
    .toBeDisabled();
  await expect.element(page.getByRole("button", { name: /Network/ })).toBeDisabled();
  await expect
    .element(page.getByRole("button", { name: "Back to details", exact: true }))
    .toBeDisabled();
  await expect
    .element(page.getByRole("textbox", { name: /Registry address/ }))
    .toHaveAttribute("readonly");
  expect(onCreate).not.toHaveBeenCalled();

  const request = JSON.parse(String(rpc.mock.calls[0]?.[1]?.body)) as { id: number };
  resolveBlock(Response.json({ jsonrpc: "2.0", id: request.id, result: "0x123" }));
  await expect.poll(() => onCreate.mock.calls.length).toBe(1);
  expect(rpc).toHaveBeenCalledTimes(4);
  rpc.mockClear();
});
