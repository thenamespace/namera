// oxlint-disable react-perf/jsx-no-new-function-as-prop
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Schema } from "effect";
import { AsyncResult, AtomRegistry } from "effect/reactivity";

import { UserActorData, WalletResponse } from "@namera-ai/protocol/dto";
import { Sidebar } from "@namera-ai/ui";
import { afterEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { currentUserAtom } from "../../src/atoms/auth/session";
import { DashboardPage } from "../../src/components/page";
import { CreateAccountForm } from "../../src/routes/_authenticated/accounts/-components/create-account-form";
import { validateAccountCreationSearch } from "../../src/routes/_authenticated/accounts/-components/creation-search";
import { AccountCreated } from "../../src/routes/_authenticated/accounts/created/-components/account-created";
import { actor } from "../fixtures/actor";
import { managedWallet } from "../fixtures/wallet-transaction";

vi.mock("../../src/env", () => ({
  env: { backendUrl: "https://api.example.test", environment: "test" },
}));
vi.mock("../../src/components/display/evm-address-display", () => ({
  EvmAddressDisplay: ({ address }: { address: string }) => <span>{address}</span>,
}));
vi.mock("../../src/telemetry", async () => {
  const { Atom } = await import("effect/reactivity");
  const { Layer } = await import("effect");
  const { FetchHttpClient } = await import("effect/http");
  const dashboardRuntime = Atom.context();
  dashboardRuntime.addGlobalLayer(
    Layer.succeed(FetchHttpClient.Fetch)((...args) => globalThis.fetch(...args)),
  );
  return { dashboardRuntime };
});

const disposers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(disposers.splice(0).map((dispose) => dispose()));
  vi.mocked(globalThis.fetch).mockClear();
});

async function mountAccountCreation(search: string) {
  const payloads: unknown[] = [];
  vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname.replace(/\/$/, "");
    if (request.method === "GET" && path === "/auth/session/me") {
      return Response.json(Schema.encodeSync(UserActorData)(actor));
    }
    if (request.method === "POST" && path === "/wallets") {
      payloads.push(await request.json());
      return Response.json(Schema.encodeSync(WalletResponse)(managedWallet), { status: 201 });
    }
    throw new Error(`Unexpected request ${request.method} ${path}`);
  });
  const registry = AtomRegistry.make({
    scheduleTask,
    initialValues: [[currentUserAtom, AsyncResult.success(actor)]],
  });
  const root = createRootRoute({
    component: () => (
      <Sidebar.Provider>
        <Outlet />
      </Sidebar.Provider>
    ),
  });
  const createAccount = createRoute({
    getParentRoute: () => root,
    path: "/accounts/new",
    validateSearch: validateAccountCreationSearch,
    component: CreateAccount,
  });
  function CreateAccount() {
    const { from } = createAccount.useSearch();
    return (
      <DashboardPage>
        <CreateAccountForm onboarding={from === "get-started"} />
      </DashboardPage>
    );
  }
  const createdAccount = createRoute({
    getParentRoute: () => root,
    path: "/accounts/created/$accountId",
    validateSearch: validateAccountCreationSearch,
    component: CreatedAccount,
  });
  function CreatedAccount() {
    const { from } = createdAccount.useSearch();
    return (
      <AccountCreated
        account={managedWallet}
        canCreateSessionKey
        onboarding={from === "get-started"}
      />
    );
  }
  const gettingStarted = createRoute({
    getParentRoute: () => root,
    path: "/get-started",
    component: () => (
      <DashboardPage>
        <p>Continue setup checklist</p>
      </DashboardPage>
    ),
  });
  const router = createRouter({
    routeTree: root.addChildren([createAccount, createdAccount, gettingStarted]),
    history: createMemoryHistory({ initialEntries: [`/accounts/new${search}`] }),
    context: { atomRegistry: registry },
  });
  const view = await render(
    <RegistryContext.Provider value={registry}>
      <RouterProvider router={router} />
    </RegistryContext.Provider>,
  );
  disposers.push(async () => {
    await view.unmount();
    registry.dispose();
  });
  return { router, payloads };
}

it.each([
  { name: "onboarding", search: "?from=get-started", onboarding: true },
  { name: "ordinary creation", search: "", onboarding: false },
  { name: "unknown source", search: "?from=unrecognized", onboarding: false },
])("preserves the expected success actions for $name", async ({ search, onboarding }) => {
  const workspace = await mountAccountCreation(search);
  await page.getByRole("textbox", { name: /Account name/ }).fill("My first account");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect.element(page.getByRole("link", { name: "View account", exact: true })).toBeVisible();
  await expect
    .element(page.getByRole("link", { name: "View account", exact: true }))
    .toHaveAttribute("href", `/account/${managedWallet.id}/overview`);
  expect(workspace.router.state.location.pathname).toBe(`/accounts/created/${managedWallet.id}`);
  expect(workspace.router.state.location.searchStr).toBe(onboarding ? "?from=get-started" : "");
  expect(workspace.payloads).toHaveLength(1);
  expect(workspace.payloads[0]).not.toHaveProperty("from");
  await expect
    .element(page.getByRole("link", { name: /Create session key/ }))
    .toHaveAttribute(
      "href",
      `/session-keys/new?accountId=${managedWallet.id}${onboarding ? "&from=get-started" : ""}`,
    );

  const continueSetup = page.getByRole("link", { name: "Continue setup", exact: true });
  if (onboarding) {
    await expect.element(continueSetup).toHaveAttribute("href", "/get-started");
    await continueSetup.click();
    await expect.element(page.getByText("Continue setup checklist", { exact: true })).toBeVisible();
  } else {
    await expect.element(continueSetup).not.toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: /Create session key/ })).toBeVisible();
  }
});
