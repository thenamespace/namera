import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Sidebar } from "@namera-ai/ui";
import { describe, expect, it } from "vitest";

import { DataLoading } from "../../../src/components/data-loading";
import { DashboardPage } from "../../../src/components/page";
import { DashboardShellContext, RouteState } from "../../../src/components/page/route-state";
import { RouterError } from "../../../src/components/route-failure";

describe("dashboard route fallback shell", () => {
  it("retains the page panel for loading and errors inside a sidebar", () => {
    for (const content of [
      createElement(RouterError),
      createElement(RouteState, null, createElement(DataLoading, { label: "Loading page" })),
    ]) {
      const html = renderToStaticMarkup(
        createElement(
          Sidebar.Provider,
          null,
          createElement(DashboardShellContext.Provider, { value: true }, content),
        ),
      );
      expect(html).toContain("sidebar__main");
      expect(html).toContain("bg-background");
      expect(html).toContain("place-items-center");
    }
  });
  it("does not require a sidebar during authentication failures", () => {
    const html = renderToStaticMarkup(createElement(RouterError));
    expect(html).toContain("Couldn’t load this page");
    expect(html).not.toContain("sidebar__main");
  });
  it("reuses the panel when a nested account route fails", () => {
    const html = renderToStaticMarkup(
      createElement(
        Sidebar.Provider,
        null,
        createElement(
          DashboardShellContext.Provider,
          { value: true },
          createElement(DashboardPage, null, createElement(RouterError)),
        ),
      ),
    );
    expect(html.match(/class="sidebar__main/g)).toHaveLength(1);
    expect(html).toContain("Couldn’t load this page");
  });
});
