import { useEffect } from "react";

import { useRouterState } from "@tanstack/react-router";

import {
  analyticsPage,
  captureAnalytics,
  initializeAnalytics,
} from "@namera-ai/telemetry/analytics/browser";
import { analyticsRoute } from "@namera-ai/telemetry/analytics/contract";

export function ProductAnalytics() {
  const route = useRouterState({
    select: (state) => {
      const match = state.matches.at(-1);
      if (
        match?.routeId === "/blog/$slug" &&
        match.loaderData &&
        typeof match.loaderData === "object" &&
        "slug" in match.loaderData
      ) {
        return `/blog/${String(match.loaderData.slug)}`;
      }
      if (
        match?.routeId === "/docs/$" &&
        match.loaderData &&
        typeof match.loaderData === "object" &&
        "url" in match.loaderData
      ) {
        return String(match.loaderData.url);
      }
      return analyticsRoute(match?.routeId ?? "/unknown");
    },
  });
  useEffect(() => {
    initializeAnalytics({
      key: import.meta.env.VITE_POSTHOG_KEY ?? "",
      production: import.meta.env.PROD,
      surface: "web",
    });
    analyticsPage(route);
  }, [route]);
  useEffect(() => {
    if (!route) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const tab = target?.closest('[role="tab"]');
      const packageManager = tab?.textContent?.trim();
      if (
        route.startsWith("/docs") &&
        tab?.getAttribute("aria-selected") !== "true" &&
        packageManager &&
        ["npm", "pnpm", "yarn", "bun"].includes(packageManager)
      ) {
        captureAnalytics("docs_package_manager_selected", { action: packageManager });
      }
      if (
        route.startsWith("/docs") &&
        tab?.getAttribute("aria-selected") !== "true" &&
        packageManager &&
        /^[\w.-]+\.(ts|tsx|js|json|toml)$/.test(packageManager)
      ) {
        captureAnalytics("docs_example_file_selected", { action: packageManager });
      }
      const link = target?.closest("a");
      if (link) {
        // Public navigation only: never read input values, link queries, or clipboard data.
        const url = new URL(link.href, location.origin);
        const destination = url.origin === location.origin ? url.pathname : url.hostname;
        const integration = /^\/docs\/(sdk|cli|mcp)(\/|$)/.test(url.pathname);
        captureAnalytics(
          url.hostname === "dashboard.namera.ai"
            ? "cta_clicked"
            : route.startsWith("/docs") && ["chatgpt.com", "claude.ai"].includes(url.hostname)
              ? "docs_assistant_opened"
              : route.startsWith("/docs")
                ? "docs_navigation_clicked"
                : integration
                  ? "integration_link_clicked"
                  : "public_link_clicked",
          {
            destination,
            placement:
              link.dataset.analyticsPlacement ??
              (target?.closest("footer")
                ? "footer"
                : target?.closest("nav")
                  ? "navigation"
                  : "content"),
          },
        );
      }
    };
    document.addEventListener("click", onClick, true);
    const dwellTimers = new Map<Element, ReturnType<typeof setTimeout>>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            if (!dwellTimers.has(entry.target))
              dwellTimers.set(
                entry.target,
                setTimeout(() => {
                  if (document.visibilityState === "visible")
                    captureAnalytics("marketing_section_seen", { section: entry.target.id });
                  observer.unobserve(entry.target);
                  dwellTimers.delete(entry.target);
                }, 1_000),
              );
          } else {
            clearTimeout(dwellTimers.get(entry.target));
            dwellTimers.delete(entry.target);
          }
      },
      { threshold: 0.5 },
    );
    document.querySelectorAll("main section[id]").forEach((section) => observer.observe(section));
    return () => {
      document.removeEventListener("click", onClick, true);
      observer.disconnect();
      dwellTimers.forEach(clearTimeout);
    };
  }, [route]);
  useEffect(() => {
    const docs = route.startsWith("/docs");
    if (!docs && !route.startsWith("/blog/")) return;
    let visibleSeconds = 0;
    const reached = new Set<number>();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      visibleSeconds += 1;
      if (visibleSeconds === 30)
        captureAnalytics(docs ? "docs_page_engaged" : "blog_article_engaged", {
          duration_ms: 30_000,
        });
    }, 1_000);
    const onScroll = () => {
      const article = document.querySelector("article");
      if (!article || document.visibilityState !== "visible") return;
      const rect = article.getBoundingClientRect();
      const progress = (window.innerHeight - rect.top) / rect.height;
      for (const threshold of [50, 90]) {
        if (progress >= threshold / 100 && !reached.has(threshold)) {
          reached.add(threshold);
          captureAnalytics("content_scroll_reached", { action: `${threshold}_percent` });
        }
      }
    };
    // Capture phase also sees the documentation layout's nested scroll container.
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [route]);
  return null;
}
