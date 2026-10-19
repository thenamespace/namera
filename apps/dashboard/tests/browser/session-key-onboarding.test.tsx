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

import {
  SessionKeyResponse,
  UserActorData,
  WalletResponse,
  type CreateEvmSessionKeyRequest,
} from "@namera-ai/protocol/dto";
import { Sidebar } from "@namera-ai/ui";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { currentUserAtom } from "../../src/atoms/auth/session";
import { DashboardPage } from "../../src/components/page";
import { SessionKeyCreated } from "../../src/components/session-key-creation/created";
import type * as SessionKeyHooks from "../../src/hooks/session-key";
import { CreateSessionKeyPage } from "../../src/routes/_authenticated/session-keys/-components/create-session-key-page";
import {
  validateSessionCreationSearch,
  validateSessionCreationSource,
} from "../../src/routes/_authenticated/session-keys/-components/creation-search";
import { actor } from "../fixtures/actor";
import {
  newestSessionAccount,
  olderSessionAccount,
  sessionPresetAccounts,
  registeredPresetSession,
} from "../fixtures/session-key-preset";

const boundary = vi.hoisted(() => ({ mutate: vi.fn() }));
let callbacks: NonNullable<Parameters<typeof SessionKeyHooks.useCreateSessionKey>[0]>;
let serverSession: SessionKeyResponse | undefined;
vi.mock("../../src/hooks/session-key", async (importOriginal) => {
  const hooks = await importOriginal<typeof SessionKeyHooks>();
  return {
    ...hooks,
    useCreateSessionKey: (options: typeof callbacks) => {
      callbacks = options;
      return { mutate: boundary.mutate, isPending: false };
    },
  };
});
// Network approval has its own boundary tests; navigation here never signs or submits.
vi.mock("../../src/components/session-key-installations", () => ({
  SessionKeyInstallations: () => <p>Network approvals</p>,
}));
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
  boundary.mutate.mockReset();
  serverSession = undefined;
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
    if (request.method === "GET" && serverSession && path === `/session-keys/${serverSession.id}`) {
      return Response.json(Schema.encodeSync(SessionKeyResponse)(serverSession));
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
    const { accountId, preset, from } = route.useSearch();
    return <CreateSessionKeyPage canCreate accountId={accountId} preset={preset} from={from} />;
  }
  const created = createRoute({
    getParentRoute: () => root,
    path: "/session-keys/created/$sessionKeyId",
    validateSearch: validateSessionCreationSource,
    component: CreatedSessionRoute,
  });
  function CreatedSessionRoute() {
    const { from } = created.useSearch();
    if (!serverSession) throw new Error("Expected a created session fixture");
    return <SessionKeyCreated sessionKey={serverSession} onboarding={from === "get-started"} />;
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
    routeTree: root.addChildren([route, created, gettingStarted]),
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
  await expect.poll(() => router.state.location.searchStr).toBe("?from=get-started");
  expect(boundary.mutate).not.toHaveBeenCalled();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect.element(page.getByText("Start and expiry", { exact: true })).toBeVisible();
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
  await expect.poll(() => router.state.location.searchStr).toBe("?from=get-started");
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

it("keeps the return source without reapplying the consumed preset", async () => {
  await mountCreation(`?accountId=${olderSessionAccount.id}&from=get-started`);
  await expect.element(page.getByRole("textbox", { name: /^Name/ })).toHaveValue("");
  await expect.element(page.getByText("Older account", { exact: true }).first()).toBeVisible();
  expect(boundary.mutate).not.toHaveBeenCalled();
});

it("validates missing permissions on Create and lets users choose a policy", async () => {
  await mountCreation();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const create = page.getByRole("button", { name: "Create session key", exact: true });
  await expect.element(create).toBeEnabled();
  await page
    .getByRole("button", { name: "Remove unrestricted account access", exact: true })
    .click();
  await expect.element(create).toBeEnabled();
  await expect
    .element(page.getByText("Add an account permission for Base to continue.", { exact: true }))
    .not.toBeInTheDocument();
  await create.click();
  const policies = page.getByRole("group", { name: "Base policies", exact: true });
  await expect
    .element(policies.getByRole("alert"))
    .toHaveTextContent("Add at least one account access policy for Base.");
  expect(document.activeElement).toBe(policies.element());
  expect(boundary.mutate).not.toHaveBeenCalled();
  await policies.getByRole("button", { name: "Add policy", exact: true }).click();
  await expect
    .element(page.getByRole("dialog", { name: "Add a policy", exact: true }))
    .toBeVisible();
  await page
    .getByRole("button", { name: "Configure Unrestricted account access", exact: true })
    .click();
  await expect
    .element(page.getByText("Add an account permission for Base to continue.", { exact: true }))
    .not.toBeInTheDocument();
  await create.click();
  await expect.poll(() => boundary.mutate.mock.calls.length).toBe(1);
});

it("guides ordinary creation before any permissions are configured", async () => {
  await mountCreation(`?accountId=${olderSessionAccount.id}`);
  await page.getByRole("textbox", { name: /^Name/ }).fill("Agent key");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const policies = page.getByRole("group", { name: "Ethereum policies", exact: true });
  await expect.element(policies.getByRole("alert")).not.toBeInTheDocument();
  const create = page.getByRole("button", { name: "Create session key", exact: true });
  await expect.element(create).toBeEnabled();
  await create.click();
  await expect.element(policies.getByRole("alert")).toBeVisible();
  expect(boundary.mutate).not.toHaveBeenCalled();
});

it("reveals and focuses an invalid network when creating from another network", async () => {
  await mountCreation();
  await expect
    .element(page.getByRole("textbox", { name: /^Name/ }))
    .toHaveValue("My first session key");
  await page.getByRole("button", { name: /Networks/ }).click();
  await page.getByRole("option", { name: "Ethereum", exact: true }).click();
  await userEvent.keyboard("{Escape}");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect
    .element(page.getByRole("group", { name: "Base policies", exact: true }))
    .toBeVisible();
  await page.getByRole("button", { name: "Create session key", exact: true }).click();
  const policies = page.getByRole("group", { name: "Ethereum policies", exact: true });
  await expect.element(policies).toBeVisible();
  await expect
    .element(policies.getByRole("alert"))
    .toHaveTextContent("Add at least one account access policy for Ethereum.");
  expect(document.activeElement).toBe(policies.element());
  expect(boundary.mutate).not.toHaveBeenCalled();
});

it("keeps Create available and explains when a policy draft needs to be saved", async () => {
  await mountCreation();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Edit start and expiry", exact: true }).click();
  const create = page.getByRole("button", { name: "Create session key", exact: true });
  await expect.element(create).toBeEnabled();
  await create.click();
  await expect
    .element(
      page.getByText("Save or cancel the policy you’re editing before creating the key.", {
        exact: true,
      }),
    )
    .toBeVisible();
  expect(boundary.mutate).not.toHaveBeenCalled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect
    .element(
      page.getByText("Save or cancel the policy you’re editing before creating the key.", {
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
});

it.each([false, true])(
  "carries onboarding through success and returns to setup (active: %s)",
  async (active) => {
    const router = await mountCreation("?preset=get-started&from=get-started");
    boundary.mutate.mockImplementation(({ payload }: { payload: CreateEvmSessionKeyRequest }) => {
      const registration = registeredPresetSession(payload);
      serverSession = active
        ? {
            ...registration,
            status: "active",
            installations: registration.installations.map((installation) => ({
              ...installation,
              status: "installed",
            })),
          }
        : registration;
      void callbacks.onSuccess?.(registration, { payload });
    });
    await expect.poll(() => router.state.location.searchStr).toBe("?from=get-started");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Create session key", exact: true }).click();
    await expect
      .element(page.getByRole("heading", { name: "Finish setting up your key" }))
      .toBeVisible();
    await page
      .getByRole("button", { name: active ? "Continue" : "Skip for now", exact: true })
      .click();
    const continueSetup = page.getByRole("link", { name: "Continue setup", exact: true });
    await expect.element(continueSetup).toHaveAttribute("href", "/get-started");
    await expect
      .element(page.getByRole("link", { name: "View session key", exact: true }))
      .toBeVisible();
    expect(router.state.location.searchStr).toBe("?from=get-started");
    expect(router.state.location.pathname).toContain("/session-keys/created/");
    expect(boundary.mutate).toHaveBeenCalledOnce();
    expect(boundary.mutate.mock.calls[0]?.[0].payload).not.toHaveProperty("from");
    expect(boundary.mutate.mock.calls[0]?.[0].payload).not.toHaveProperty("preset");

    if (!serverSession) throw new Error("Expected a registered session");
    const sessionKeyId = serverSession.id;
    await router.navigate({
      to: "/session-keys/created/$sessionKeyId",
      params: { sessionKeyId },
      search: {},
    });
    await expect.element(continueSetup).not.toBeInTheDocument();
    await expect
      .element(page.getByRole("link", { name: "View session key", exact: true }))
      .toBeVisible();
    await router.navigate({
      to: "/session-keys/created/$sessionKeyId",
      params: { sessionKeyId },
      search: { from: "get-started" },
    });
    await continueSetup.click();
    await expect.element(page.getByText("Continue setup checklist", { exact: true })).toBeVisible();
  },
);
