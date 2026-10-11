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
      const link = target?.closest("a");
      if (link) {
        // Public navigation only: never read input values, link queries, or clipboard data.
        const url = new URL(link.href, location.origin);
        const destination = url.origin === location.origin ? url.pathname : url.hostname;
        captureAnalytics(
          url.hostname === "dashboard.namera.ai" ? "cta_clicked" : "integration_link_clicked",
          {
            destination,
            placement: target?.closest("footer")
              ? "footer"
              : target?.closest("nav")
                ? "navigation"
                : "content",
          },
        );
      }
    };
    document.addEventListener("click", onClick);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            captureAnalytics("marketing_section_seen", { section: entry.target.id });
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.5 },
    );
    document.querySelectorAll("main section[id]").forEach((section) => observer.observe(section));
    return () => {
      document.removeEventListener("click", onClick);
      observer.disconnect();
    };
  }, [route]);
  return null;
}
