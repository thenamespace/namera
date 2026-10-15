import { Sidebar } from "@namera-ai/ui";
import { expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { DataLoading } from "../../src/components/data-loading";
import { DashboardPage } from "../../src/components/page";
import { DashboardShellContext, RouteState } from "../../src/components/page/route-state";
import { RouterError } from "../../src/components/route-failure";

it("keeps a loading announcement inside the dashboard panel", async () => {
  await render(
    <Sidebar.Provider>
      <DashboardShellContext.Provider value={true}>
        <RouteState>
          <DataLoading label="Loading page" />
        </RouteState>
      </DashboardShellContext.Provider>
    </Sidebar.Provider>,
  );
  await expect.element(page.getByRole("main")).toBeVisible();
  await expect.element(page.getByRole("status")).toHaveTextContent("Loading page");
});

it("renders an accessible retry state outside the dashboard without exposing the error", async () => {
  await render(
    <RouterError error={new Error("https://provider.example/private-request?token=secret")} />,
  );
  await expect
    .element(page.getByRole("heading", { name: "Couldn’t load this page" }))
    .toBeVisible();
  await expect.element(page.getByRole("button", { name: "Reload page" })).toBeEnabled();
  expect(page.getByRole("main").elements()).toHaveLength(0);
  expect(document.body.textContent).not.toContain("private-request");
  expect(document.body.textContent).not.toContain("token=secret");
});

it("reuses the existing page panel when a nested route fails", async () => {
  await render(
    <Sidebar.Provider>
      <DashboardShellContext.Provider value={true}>
        <DashboardPage>
          <RouterError />
        </DashboardPage>
      </DashboardShellContext.Provider>
    </Sidebar.Provider>,
  );
  expect(page.getByRole("main").elements()).toHaveLength(1);
  await expect
    .element(page.getByRole("main").getByRole("heading", { name: "Couldn’t load this page" }))
    .toBeVisible();
});
