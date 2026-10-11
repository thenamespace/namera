import { useEffect } from "react";

import { useRouterState } from "@tanstack/react-router";

import {
  analyticsIdentity,
  analyticsPage,
  captureAnalytics,
  initializeAnalytics,
} from "@namera-ai/telemetry/analytics/browser";
import { analyticsRoute } from "@namera-ai/telemetry/analytics/contract";

import { env } from "@/env";
import { useCurrentUser } from "@/hooks/auth/session";

export function ProductAnalytics() {
  const actor = useCurrentUser();
  const route = useRouterState({ select: (state) => state.matches.at(-1)?.routeId ?? "/unknown" });
  const userId = actor.data?.user.id;
  const workspaceId = actor.data?.organization.id;
  const name = actor.data?.user.metadata.name;
  const workspaceName = actor.data?.organization.metadata.name;
  useEffect(() => {
    initializeAnalytics({
      key: env.posthogKey,
      production: env.environment === "production",
      surface: "dashboard",
    });
    analyticsIdentity(userId, workspaceId, name, workspaceName);
    analyticsPage(analyticsRoute(route));
  }, [route, userId, workspaceId, name, workspaceName]);
  useEffect(() => {
    const page = analyticsRoute(route);
    const setup = [
      "/auth",
      "/auth/invite",
      "/workspace/new",
      "/accounts/new",
      "/session-keys/new",
      "/oauth/authorize",
      "/cli/authorize",
    ];
    if (setup.includes(page)) captureAnalytics("dashboard_setup_started", { action: page });
  }, [route]);
  return null;
}
