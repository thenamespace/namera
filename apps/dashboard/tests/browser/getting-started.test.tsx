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
  ApiKeyResponse,
  GetDashboardOverviewResponse,
  SessionKeyResponse,
  UserActorData,
  type ListApiKeysResponse,
} from "@namera-ai/protocol/dto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { apiKeysAtom } from "../../src/atoms/api-key";
import { cliAuthorizationsAtom, mcpAuthorizationsAtom } from "../../src/atoms/auth/oauth";
import { userOrganizationsAtom } from "../../src/atoms/auth/organization";
import { currentUserAtom } from "../../src/atoms/auth/session";
import { dashboardOverviewAtom } from "../../src/atoms/dashboard";
import { gettingStartedAtom } from "../../src/atoms/getting-started";
import { sessionKeysAtom } from "../../src/atoms/session-key";
import { DashboardPage } from "../../src/components/page";
import { AppSidebar } from "../../src/components/sidebar/main-sidebar";
import { gettingStartedStorageKey } from "../../src/lib/getting-started";
import { GettingStartedPage } from "../../src/routes/_authenticated/-components/getting-started/page";
import {
  setupActor,
  setupApiKey,
  setupOverview,
  setupSessionKey,
} from "../fixtures/getting-started";

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

const storageKey = gettingStartedStorageKey(setupActor.user.id, setupActor.organization.id);
const disposers: (() => Promise<void>)[] = [];

beforeEach(async () => {
  localStorage.removeItem(storageKey);
  await page.viewport(1440, 1000);
});
afterEach(async () => {
  await Promise.all(disposers.splice(0).map((dispose) => dispose()));
  localStorage.removeItem(storageKey);
  vi.mocked(globalThis.fetch).mockClear();
});

async function mountSetup(
  overview = setupOverview(),
  actor: UserActorData = setupActor,
  apiKeys: ListApiKeysResponse = [],
  sessionKeys: readonly SessionKeyResponse[] = overview.resources.sessionKeys.total > 0
    ? [setupSessionKey()]
    : [],
) {
  const requests: string[] = [];
  let fetchedSessionKeys = sessionKeys;
  vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname.replace(/\/$/, "");
    requests.push(path);
    if (request.method !== "GET") throw new Error(`Unexpected mutation ${request.method} ${path}`);
    if (path === "/auth/session/me") return Response.json(Schema.encodeSync(UserActorData)(actor));
    if (path === "/dashboard/overview")
      return Response.json(Schema.encodeSync(GetDashboardOverviewResponse)(overview));
    if (path === "/api-keys")
      return Response.json(apiKeys.map((key) => Schema.encodeSync(ApiKeyResponse)(key)));
    if (path === "/session-keys")
      return Response.json(
        fetchedSessionKeys.map((key) => Schema.encodeSync(SessionKeyResponse)(key)),
      );
    if (
      [
        "/oauth/authorizations",
        "/oauth/cli-authorizations",
        "/auth/organization/list-user-organizations",
      ].includes(path)
    )
      return Response.json([]);
    throw new Error(`Unexpected request ${path}`);
  });
  const registry = AtomRegistry.make({
    scheduleTask,
    defaultIdleTTL: 30_000,
    initialValues: [
      [currentUserAtom, AsyncResult.success(actor)],
      [dashboardOverviewAtom, AsyncResult.success(overview)],
      [sessionKeysAtom, AsyncResult.success(sessionKeys)],
      [apiKeysAtom, AsyncResult.success(apiKeys)],
      [cliAuthorizationsAtom, AsyncResult.success([])],
      [mcpAuthorizationsAtom, AsyncResult.success([])],
      [userOrganizationsAtom, AsyncResult.success([])],
    ],
  });
  const root = createRootRoute({
    component: () => (
      <AppSidebar>
        <Outlet />
      </AppSidebar>
    ),
  });
  const gettingStarted = createRoute({
    getParentRoute: () => root,
    path: "/get-started",
    component: GettingStartedPage,
  });
  const overviewRoute = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => (
      <DashboardPage>
        <p>Workspace overview</p>
      </DashboardPage>
    ),
  });
  const router = createRouter({
    routeTree: root.addChildren([gettingStarted, overviewRoute]),
    history: createMemoryHistory({ initialEntries: ["/get-started"] }),
    context: { atomRegistry: registry },
  });
  const view = await render(
    <RegistryContext.Provider value={registry}>
      <RouterProvider router={router} />
    </RegistryContext.Provider>,
  );
  const dispose = async () => {
    await view.unmount();
    registry.dispose();
  };
  disposers.push(dispose);
  return {
    registry,
    router,
    requests,
    updateSessionKeys: (updatedSessionKeys: readonly SessionKeyResponse[]) => {
      fetchedSessionKeys = updatedSessionKeys;
      registry.refresh(sessionKeysAtom);
    },
  };
}

it("shows the sidebar progress and changes its illustration with the selected step", async () => {
  await mountSetup();
  await expect.element(page.getByRole("heading", { name: "Let’s get you set up." })).toBeVisible();
  await expect
    .element(page.getByRole("link", { name: /Get started/ }))
    .toHaveTextContent("Get started0/4");
  await expect
    .element(page.getByRole("button", { name: /Create your first account/ }))
    .toHaveAttribute("aria-expanded", "true");
  await expect.element(page.getByRole("figure", { name: "Setup step 1" })).toBeVisible();
  await expect
    .element(page.getByRole("link", { name: "Create account", exact: true }))
    .toHaveAttribute("href", "/accounts/new?from=get-started");
  await page.getByRole("button", { name: /Give your agent a session key/ }).click();
  await expect.element(page.getByRole("figure", { name: "Setup step 2" })).toBeVisible();
  await expect
    .element(page.getByText("Create your account first, then add a session key."))
    .toBeVisible();
  await expect
    .element(page.getByRole("link", { name: "Create session key", exact: true }))
    .not.toBeInTheDocument();
  await page.getByRole("button", { name: /Connect your AI client/ }).click();
  await expect.element(page.getByRole("figure", { name: "Setup step 3" })).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Copy install namera cli", exact: true }))
    .toBeVisible();
  await expect.element(page.getByRole("radiogroup")).not.toBeInTheDocument();
  await page.getByRole("button", { name: /Make your first transaction or signature/ }).click();
  await expect.element(page.getByRole("figure", { name: "Setup step 4" })).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Done", exact: true }))
    .not.toBeInTheDocument();
});

it("links to the session preset and explains its defaults", async () => {
  await mountSetup(setupOverview({ accounts: 1 }));
  await expect
    .element(page.getByRole("link", { name: "Create session key", exact: true }))
    .toHaveAttribute("href", "/session-keys/new?preset=get-started&from=get-started");
  await expect
    .element(
      page.getByText(
        "We’ll prefill a key for your newest account on Base, valid for 30 days, with message signing and full account access.",
        { exact: true },
      ),
    )
    .toBeVisible();
});

it("resumes at the first unfinished step and retains navigation to Overview", async () => {
  await mountSetup(setupOverview({ accounts: 1, sessionKeys: 1 }));
  await expect
    .element(page.getByRole("progressbar", { name: "Setup progress" }))
    .toHaveAttribute("value", "2");
  await expect
    .element(page.getByRole("button", { name: /Connect your AI client/ }))
    .toHaveAttribute("aria-expanded", "true");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect.element(page.getByText("Workspace overview", { exact: true })).toBeVisible();
  await expect.element(page.getByRole("link", { name: /Get started/ })).toBeVisible();
});

it.each(["pending", "failed", "submitted"] as const)(
  "keeps the session step incomplete for a %s network and links to its approval",
  async (status) => {
    const sessionKey = setupSessionKey(status);
    const workspace = await mountSetup(
      setupOverview({ accounts: 1, sessionKeys: 1 }),
      setupActor,
      [],
      [sessionKey],
    );
    await expect
      .element(page.getByRole("button", { name: /Give your agent a session key/ }))
      .toHaveAttribute("aria-expanded", "true");
    await expect
      .element(page.getByRole("progressbar", { name: "Setup progress" }))
      .toHaveAttribute("value", "1");
    await expect
      .element(
        page.getByText(
          status === "submitted"
            ? "Your key is created. Network approval is awaiting confirmation."
            : "Your key is created. Approve it on a network before connecting your AI client.",
        ),
      )
      .toBeVisible();
    await expect
      .element(
        page.getByRole("link", {
          name: status === "submitted" ? "View network approval" : "Approve session key",
          exact: true,
        }),
      )
      .toHaveAttribute("href", `/session-key/${sessionKey.id}/overview`);
    await expect
      .element(page.getByRole("link", { name: "Create session key", exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByText(/We’ll prefill a key for your newest account/))
      .not.toBeInTheDocument();

    workspace.updateSessionKeys([setupSessionKey()]);
    await expect
      .element(page.getByRole("progressbar", { name: "Setup progress" }))
      .toHaveAttribute("value", "2");
    await expect
      .element(page.getByRole("button", { name: /Connect your AI client/ }))
      .toHaveAttribute("aria-expanded", "true");
  },
);

it("only dismisses after Done, removes the sidebar entry, and remembers dismissal", async () => {
  const workspace = await mountSetup(
    setupOverview({ accounts: 1, sessionKeys: 1, executions: 1, source: "cli" }),
  );
  await expect.element(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  expect(localStorage.getItem(storageKey)).toBeNull();
  await expect
    .element(page.getByRole("link", { name: /Get started/ }))
    .toHaveTextContent("Get started4/4");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect.element(page.getByText("Workspace overview", { exact: true })).toBeVisible();
  await expect.element(page.getByRole("link", { name: /Get started/ })).not.toBeInTheDocument();
  expect(localStorage.getItem(storageKey)).toBe("true");
  await workspace.router.navigate({ to: "/get-started" });
  await expect.element(page.getByText("Workspace overview", { exact: true })).toBeVisible();
  await expect
    .element(page.getByRole("heading", { name: "You’re all set." }))
    .not.toBeInTheDocument();
});

it("does not fetch denied progress or display the checklist for a restricted role", async () => {
  const workspace = await mountSetup(setupOverview(), {
    ...setupActor,
    role: { ...setupActor.role, permissions: [] },
  });
  await expect.element(page.getByText("Workspace overview", { exact: true })).toBeVisible();
  expect(workspace.registry.get(gettingStartedAtom).available).toBe(false);
  expect(workspace.requests).not.toContain("/dashboard/overview");
  expect(workspace.requests).not.toContain("/session-keys");
  expect(workspace.requests).not.toContain("/api-keys");
  expect(workspace.requests).not.toContain("/oauth/authorizations");
  await expect.element(page.getByRole("link", { name: /Get started/ })).not.toBeInTheDocument();
});

it("supports keyboard selection of checklist steps", async () => {
  await mountSetup();
  await expect
    .element(page.getByRole("button", { name: /Give your agent a session key/ }))
    .toBeVisible();
  const button = page.getByRole("button", { name: /Give your agent a session key/ });
  button.element().focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(button).toHaveAttribute("aria-expanded", "true");
});

it.each([false, true])(
  "requires actual API key usage to count the SDK connection (used: %s)",
  async (used) => {
    await mountSetup(setupOverview({ accounts: 1, sessionKeys: 1 }), setupActor, [
      setupApiKey(used),
    ]);
    await expect
      .element(page.getByRole("progressbar", { name: "Setup progress" }))
      .toHaveAttribute("value", used ? "3" : "2");
  },
);

it("keeps the checklist usable on a narrow screen without horizontal scrolling", async () => {
  await page.viewport(390, 844);
  await mountSetup();
  await expect.element(page.getByRole("heading", { name: "Let’s get you set up." })).toBeVisible();
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  await page.getByRole("button", { name: /Connect your AI client/ }).click();
  await expect
    .element(page.getByRole("button", { name: "Copy install namera cli", exact: true }))
    .toBeVisible();
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect.element(page.getByRole("link", { name: /Get started/ })).toBeVisible();
});

it("offers MCP starter prompts without SDK or CLI choices", async () => {
  const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  await mountSetup(setupOverview({ accounts: 1, sessionKeys: 1 }));
  await page.getByRole("button", { name: /Make your first transaction or signature/ }).click();
  await expect.element(page.getByRole("radiogroup")).not.toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: "A little more direction" }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: "Sign a message", exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole("heading", { name: "Send a transaction", exact: true }))
    .toBeVisible();
  await page.getByRole("button", { name: "Copy message signing prompt", exact: true }).click();
  await expect.poll(() => writeText.mock.calls.length).toBe(1);
  expect(writeText.mock.calls[0]?.[0]).toBe(
    'Use Namera MCP to sign "Hello from Namera" with my session key.',
  );
  await page.getByRole("button", { name: "Copy transaction prompt", exact: true }).click();
  await expect.poll(() => writeText.mock.calls.length).toBe(2);
  expect(writeText.mock.calls[1]?.[0]).toBe(
    "Use Namera MCP to send a transaction. Ask for the recipient and amount, then confirm before sending.",
  );
});

it("copies inline installation, client-specific setup, and a read-only first request", async () => {
  const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  await mountSetup(setupOverview({ accounts: 1, sessionKeys: 1 }));
  await page.getByRole("button", { name: "Copy install namera cli", exact: true }).click();
  await expect.poll(() => writeText.mock.calls.length).toBe(1);
  expect(writeText.mock.calls[0]?.[0]).toBe("npm install -g @namera-ai/cli");
  await page.getByRole("button", { name: "Copy claude code mcp setup", exact: true }).click();
  await expect.poll(() => writeText.mock.calls.length).toBe(2);
  expect(writeText.mock.calls[1]?.[0]).toBe(
    "claude mcp add --transport stdio --scope user namera -- namera mcp serve --profile claude",
  );
  await page.getByRole("button", { name: /MCP client/ }).click();
  await page.getByRole("option", { name: "Codex", exact: true }).click();
  await expect
    .element(page.getByRole("button", { name: "Copy claude code mcp setup", exact: true }))
    .not.toBeInTheDocument();
  await page.getByRole("button", { name: "Copy codex mcp setup", exact: true }).click();
  await expect.poll(() => writeText.mock.calls.length).toBe(3);
  expect(writeText.mock.calls[2]?.[0]).toBe(
    "codex mcp add namera -- namera mcp serve --profile codex",
  );
  await page.getByRole("button", { name: /MCP client/ }).click();
  await page.getByRole("option", { name: "Gemini CLI", exact: true }).click();
  await page.getByRole("button", { name: "Copy gemini cli mcp setup", exact: true }).click();
  await expect.poll(() => writeText.mock.calls.length).toBe(4);
  expect(writeText.mock.calls[3]?.[0]).toBe(
    "gemini mcp add --scope user --transport stdio namera namera mcp serve -- --profile gemini",
  );
  await expect
    .element(page.getByRole("link", { name: "View setup guides" }))
    .toHaveAttribute("href", "https://namera.ai/docs/mcp/clients");
  await page.getByRole("button", { name: "Copy first namera request", exact: true }).click();
  await expect.poll(() => writeText.mock.calls.length).toBe(5);
  expect(writeText.mock.calls[4]?.[0]).toBe("Use Namera MCP to list my accounts and session keys.");
  await expect
    .element(page.getByRole("progressbar", { name: "Setup progress" }))
    .toHaveAttribute("value", "2");
});
