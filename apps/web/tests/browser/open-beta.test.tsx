import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

import { captureAnalytics } from "@namera-ai/telemetry/analytics/browser";
import { afterEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { HeroCta } from "../../src/components/marketing/hero-cta";
import { SiteHeader } from "../../src/components/marketing/site-header";
import { Comparison } from "../../src/components/pricing/comparison";
import { PlanCards } from "../../src/components/pricing/plan-cards";
import { ProductAnalytics } from "../../src/components/product-analytics";

import "../../src/styles/index.css";

vi.mock("@namera-ai/telemetry/analytics/browser", () => ({
  captureAnalytics: vi.fn(),
  analyticsPage: vi.fn(),
  initializeAnalytics: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const placements = ["header", "hero", "closing", "pricing-cards", "pricing-comparison"];
const preventNavigation = (event: Event) => {
  if (event.target instanceof Element && event.target.closest("a")) event.preventDefault();
};

it.each(placements)(
  "links %s signup to the dashboard and tracks its placement",
  async (placement) => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected request"));
    const route = createRootRoute({
      component: () => (
        <>
          <ProductAnalytics />
          <SiteHeader />
          <main className="pt-20">
            <section aria-label="Hero actions">
              <HeroCta />
            </section>
            <section aria-label="Closing actions">
              <HeroCta placement="closing" />
            </section>
            <PlanCards />
            <Comparison />
          </main>
        </>
      ),
    });
    const router = createRouter({
      routeTree: route,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    await router.load();
    const screen = await render(<RouterProvider router={router} />);
    document.addEventListener("click", preventNavigation);
    try {
      const signupLinks = page.getByRole("link", { name: "Get started", exact: true });
      expect(signupLinks.elements()).toHaveLength(5);
      await Promise.all(
        ["Hero actions", "Closing actions"].map(async (name) => {
          const docs = page
            .getByRole("region", { name })
            .getByRole("link", { name: "Docs", exact: true });
          await expect.element(docs).toBeVisible();
          await expect.element(docs).toHaveAttribute("href", "/docs");
        }),
      );
      expect(document.body.textContent).not.toContain("Open beta. No invite required.");
      expect(document.querySelector('input[type="email"]')).toBeNull();

      const link = signupLinks.nth(placements.indexOf(placement));
      await expect.element(link).toHaveAttribute("href", "https://dashboard.namera.ai");
      await link.click();
      expect(captureAnalytics).toHaveBeenCalledWith("cta_clicked", {
        destination: "dashboard.namera.ai",
        placement,
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(
        vi.mocked(captureAnalytics).mock.calls.some(([event]) => event.startsWith("waitlist_")),
      ).toBe(false);
    } finally {
      await screen.unmount();
      document.removeEventListener("click", preventNavigation);
    }
  },
);
