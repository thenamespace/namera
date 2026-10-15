// oxlint-disable react-perf/jsx-no-new-function-as-prop
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Schema } from "effect";
import { AtomRegistry } from "effect/reactivity";

import { UserActorData, WalletResponse } from "@namera-ai/protocol/dto";
import { afterEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { sessionAuthority } from "../../src/atoms/auth/authority";
import { currentUserAtom } from "../../src/atoms/auth/session";
import { prefetchQuery } from "../../src/atoms/prefetch";
import { walletsAtom } from "../../src/atoms/wallet";
import { useCreateWallet, useWallets } from "../../src/hooks/wallet";
import { SessionBoundary } from "../../src/routes/_authenticated/-components/session-boundary";
import { actor } from "../fixtures/actor";
import { managedWallet } from "../fixtures/wallet-transaction";

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

afterEach(() => vi.mocked(globalThis.fetch).mockClear());

function Accounts() {
  const query = useWallets();
  const create = useCreateWallet();
  const createAccount = () =>
    create.mutate({
      payload: {
        namespace: "eip155",
        owner: { type: "namera-managed", provider: "1claw" },
        metadata: { version: 1, name: "New account" },
      },
    });
  return (
    <>
      <output aria-label="Accounts">
        {query.data?.map((wallet) => wallet.metadata.name).join(", ")}
      </output>
      <button onClick={createAccount}>Create account</button>
    </>
  );
}

async function mountWorkspace() {
  const registry = AtomRegistry.make({ scheduleTask, defaultIdleTTL: 30_000 });
  let current: UserActorData | null = actor;
  let wallets: readonly WalletResponse[] = [managedWallet];
  const requests: string[] = [];
  vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    requests.push(`${request.method} ${path}`);
    if (path === "/auth/session/me") {
      return current
        ? Response.json(Schema.encodeSync(UserActorData)(current))
        : new Response(null, { status: 401 });
    }
    if (path === "/wallets" || path === "/wallets/") {
      if (request.method === "POST") {
        const payload = await request.json();
        const created = { ...managedWallet, metadata: payload.metadata };
        wallets = [created];
        return Response.json(Schema.encodeSync(WalletResponse)(created), { status: 201 });
      }
      return Response.json(wallets.map((wallet) => Schema.encodeSync(WalletResponse)(wallet)));
    }
    throw new Error(`Unexpected request ${request.method} ${path}`);
  });
  const root = createRootRoute();
  const workspace = createRoute({
    getParentRoute: () => root,
    path: "/",
    loader: async (): Promise<UserActorData | null> => {
      const loaded = await prefetchQuery(registry, currentUserAtom);
      if (loaded?.role.permissions.includes("wallet:read"))
        await prefetchQuery(registry, walletsAtom);
      return loaded;
    },
    component: () => {
      const loaded = workspace.useLoaderData() as UserActorData | null;
      if (!loaded) return <p>Sign in</p>;
      return (
        <SessionBoundary key={sessionAuthority(loaded)} actor={loaded}>
          {loaded.role.permissions.includes("wallet:read") ? (
            <Accounts />
          ) : (
            <p>Accounts unavailable</p>
          )}
        </SessionBoundary>
      );
    },
  });
  const router = createRouter({
    routeTree: root.addChildren([workspace]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    context: { atomRegistry: registry },
  });
  const view = await render(
    <RegistryContext.Provider value={registry}>
      <RouterProvider router={router} />
    </RegistryContext.Provider>,
  );
  return {
    registry,
    router,
    requests,
    changeAuthority(next: UserActorData | null, nextWallets: readonly WalletResponse[] = []) {
      current = next;
      wallets = nextWallets;
      registry.refresh(currentUserAtom);
    },
    async dispose() {
      await view.unmount();
      registry.dispose();
    },
  };
}

it("shares loader results with hooks and invalidates accounts after creation", async () => {
  const workspace = await mountWorkspace();
  try {
    await expect.element(page.getByLabelText("Accounts")).toHaveTextContent("Review account");
    expect(workspace.requests.filter((request) => request.startsWith("GET /wallets"))).toHaveLength(
      1,
    );
    await page.getByRole("button", { name: "Create account" }).click();
    await expect.element(page.getByLabelText("Accounts")).toHaveTextContent("New account");
    expect(
      workspace.requests.filter((request) => request.startsWith("POST /wallets")),
    ).toHaveLength(1);
    expect(
      workspace.requests.filter((request) => request.startsWith("GET /wallets")).length,
    ).toBeGreaterThan(1);
  } finally {
    await workspace.dispose();
  }
});

it("erases protected results on permission loss and does not prefetch denied accounts", async () => {
  const workspace = await mountWorkspace();
  try {
    await expect.element(page.getByLabelText("Accounts")).toHaveTextContent("Review account");
    workspace.changeAuthority({ ...actor, role: { ...actor.role, permissions: [] } });
    await expect.element(page.getByText("Accounts unavailable")).toBeVisible();
    await expect.element(page.getByLabelText("Accounts")).not.toBeInTheDocument();
    const requestsAfterRevocation = workspace.requests.filter((request) =>
      request.startsWith("GET /wallets"),
    ).length;
    await workspace.router.invalidate();
    expect(workspace.requests.filter((request) => request.startsWith("GET /wallets"))).toHaveLength(
      requestsAfterRevocation,
    );
  } finally {
    await workspace.dispose();
  }
});

it("loads only the new workspace after authority changes and clears it on logout", async () => {
  const workspace = await mountWorkspace();
  try {
    await expect.element(page.getByLabelText("Accounts")).toHaveTextContent("Review account");
    const organization = { ...actor.organization, id: managedWallet.organizationId };
    workspace.changeAuthority(
      {
        ...actor,
        organization,
        session: { ...actor.session, activeOrganizationId: organization.id },
      },
      [{ ...managedWallet, metadata: { version: 1, name: "Other workspace account" } }],
    );
    await expect
      .element(page.getByLabelText("Accounts"))
      .toHaveTextContent("Other workspace account");
    await expect.element(page.getByText("Review account", { exact: true })).not.toBeInTheDocument();
    workspace.changeAuthority(null);
    await expect.element(page.getByText("Sign in", { exact: true })).toBeVisible();
    await expect.element(page.getByLabelText("Accounts")).not.toBeInTheDocument();
    const nextUserId = "01900000-0000-7000-8000-000000000099";
    const nextActor = Schema.decodeUnknownSync(Schema.toType(UserActorData))({
      ...actor,
      user: { ...actor.user, id: nextUserId },
      session: { ...actor.session, id: "01900000-0000-7000-8000-000000000098", userId: nextUserId },
      member: {
        ...actor.member,
        user: { ...actor.user, id: nextUserId },
        organizationMember: { ...actor.member.organizationMember, userId: nextUserId },
      },
    });
    workspace.changeAuthority(nextActor, [
      { ...managedWallet, metadata: { version: 1, name: "New user account" } },
    ]);
    await workspace.router.invalidate();
    await expect.element(page.getByLabelText("Accounts")).toHaveTextContent("New user account");
    await expect
      .element(page.getByText("Other workspace account", { exact: true }))
      .not.toBeInTheDocument();
  } finally {
    await workspace.dispose();
  }
});
