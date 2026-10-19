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
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { currentUserAtom } from "../../src/atoms/auth/session";
import type * as SessionKeyHooks from "../../src/hooks/session-key";
import { CreateSessionKeyPage } from "../../src/routes/_authenticated/session-keys/-components/create-session-key-page";
import { validateSessionCreationSearch } from "../../src/routes/_authenticated/session-keys/-components/creation-search";
import { actor } from "../fixtures/actor";
import {
  newestSessionAccount,
  olderSessionAccount,
  sessionPresetAccounts,
} from "../fixtures/session-key-preset";

const boundary = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("../../src/hooks/session-key", async (importOriginal) => {
  const hooks = await importOriginal<typeof SessionKeyHooks>();
  return { ...hooks, useCreateSessionKey: () => ({ mutate: boundary.mutate, isPending: false }) };
});
vi.mock("../../src/env", () => ({
  env: { backendUrl: "https://api.example.test", environment: "test" },
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
beforeEach(async () => {
  boundary.mutate.mockClear();
  await page.viewport(1440, 1000);
});
afterEach(async () => {
  await Promise.all(disposers.splice(0).map((dispose) => dispose()));
  const scope = `namera:provisioning:${actor.organization.id}:${actor.user.id}:session:`;
  Object.keys(localStorage)
    .filter((key) => key.startsWith(scope))
    .forEach((key) => localStorage.removeItem(key));
  vi.mocked(globalThis.fetch).mockClear();
});

async function mountCreation(search = "?preset=get-started", accounts?: Promise<Response>) {
  vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname.replace(/\/$/, "");
    if (request.method === "GET" && path === "/auth/session/me") {
      return Response.json(Schema.encodeSync(UserActorData)(actor));
    }
    if (request.method === "GET" && path === "/wallets") {
      return (
        accounts ??
        Response.json(
          sessionPresetAccounts.map((account) => Schema.encodeSync(WalletResponse)(account)),
        )
      );
    }
    throw new Error(`Unexpected request ${request.method} ${path}`);
  });
  const registry = AtomRegistry.make({
    scheduleTask,
    defaultIdleTTL: 30_000,
    initialValues: [[currentUserAtom, AsyncResult.success(actor)]],
  });
  const root = createRootRoute({
    component: () => (
      <Sidebar.Provider>
        <Outlet />
      </Sidebar.Provider>
    ),
  });
  const route = createRoute({
    getParentRoute: () => root,
    path: "/session-keys/new",
    validateSearch: validateSessionCreationSearch,
    component: SessionRoute,
  });
  function SessionRoute() {
    const { accountId, preset } = route.useSearch();
    return <CreateSessionKeyPage canCreate accountId={accountId} preset={preset} />;
  }
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: [`/session-keys/new${search}`] }),
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
  return router;
}

it("enables creation for the untouched preset and submits exactly the reviewed permissions", async () => {
  const router = await mountCreation();
  await expect
    .element(page.getByRole("textbox", { name: /^Name/ }))
    .toHaveValue("My first session key");
  await expect.element(page.getByText("Newest account", { exact: true }).first()).toBeVisible();
  await expect.poll(() => router.state.location.searchStr).toBe("");
  expect(boundary.mutate).not.toHaveBeenCalled();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect.element(page.getByText("Lifetime", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Signatures", { exact: true })).toBeVisible();
  await expect
    .element(page.getByText("Unrestricted account access", { exact: true }))
    .toBeVisible();
  const create = page.getByRole("button", { name: "Create session key", exact: true });
  await expect.element(create).toBeEnabled();
  await create.click();
  await expect.poll(() => boundary.mutate.mock.calls.length).toBe(1);
  expect(boundary.mutate.mock.calls[0]?.[0]).toMatchObject({
    payload: {
      walletId: newestSessionAccount.id,
      policies: [{ type: "evm.signature", allowedTypes: ["message"] }],
      onchain: {
        installations: [
          { chainId: "eip155:8453", permissions: [{ type: "root" }], allowSignatures: true },
        ],
      },
    },
  });
});

it("consumes the preset after accounts load and preserves subsequent form edits", async () => {
  let resolveAccounts!: (response: Response) => void;
  const accounts = new Promise<Response>((resolve) => {
    resolveAccounts = resolve;
  });
  const router = await mountCreation("?preset=get-started", accounts);
  await expect.element(page.getByRole("status")).toHaveTextContent("Loading accounts");
  expect(router.state.location.searchStr).toBe("?preset=get-started");
  resolveAccounts(
    Response.json(
      sessionPresetAccounts.map((account) => Schema.encodeSync(WalletResponse)(account)),
    ),
  );
  const name = page.getByRole("textbox", { name: /^Name/ });
  await expect.element(name).toHaveValue("My first session key");
  await expect.poll(() => router.state.location.searchStr).toBe("");
  await name.fill("Edited session");
  await router.invalidate();
  await expect.element(name).toHaveValue("Edited session");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect
    .element(page.getByRole("button", { name: "Create session key", exact: true }))
    .toBeEnabled();
  await page.getByRole("button", { name: "Back to details", exact: true }).click();
  await expect.element(name).toHaveValue("Edited session");
  await name.fill("");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect.element(page.getByRole("textbox", { name: /^Name/ })).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Create session key", exact: true }))
    .not.toBeInTheDocument();
  expect(boundary.mutate).not.toHaveBeenCalled();
});

it("keeps ordinary account selection and does not apply an unknown preset", async () => {
  const router = await mountCreation(`?accountId=${olderSessionAccount.id}&preset=unknown`);
  await expect.element(page.getByRole("textbox", { name: /^Name/ })).toHaveValue("");
  await expect.element(page.getByText("Older account", { exact: true }).first()).toBeVisible();
  expect(router.state.location.searchStr).toContain("preset=unknown");
  expect(boundary.mutate).not.toHaveBeenCalled();
});

it("disables creation when the required onchain permission is removed", async () => {
  await mountCreation();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const create = page.getByRole("button", { name: "Create session key", exact: true });
  await expect.element(create).toBeEnabled();
  await page
    .getByRole("button", { name: "Remove unrestricted account access", exact: true })
    .click();
  await expect.element(create).toBeDisabled();
  expect(boundary.mutate).not.toHaveBeenCalled();
});
