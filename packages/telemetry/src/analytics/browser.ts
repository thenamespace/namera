import { posthog } from "posthog-js";

import { analyticsEvents, safeAnalyticsProperties, surveyEligible } from "./contract.js";
import type { AnalyticsEvent, AnalyticsProperties, AnalyticsSurface } from "./contract.js";
import { analyticsProfile, sanitizeAnalyticsEvent } from "./privacy.js";

let initialized = false;
let surface: AnalyticsSurface = "web";
let route = "/";
let lastPage: string | undefined;
let userId: string | undefined;
let workspaceId: string | undefined;
let workspaceName: string | undefined;
let profileName: string | undefined;
let surveyTimer: ReturnType<typeof setTimeout> | undefined;
let surveyConsidered = false;
const surveySample = Math.random();

const nativeEvents = new Set([
  "$pageview",
  "$pageleave",
  "$identify",
  "$set",
  "$exception",
  "$web_vitals",
  "$$heatmap",
  "survey shown",
  "survey dismissed",
  "survey sent",
]);
export function analyticsDisabled() {
  try {
    return (
      navigator.doNotTrack === "1" ||
      (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
    );
  } catch {
    return true;
  }
}

export function initializeAnalytics(config: {
  key: string;
  production: boolean;
  surface: AnalyticsSurface;
}) {
  if (initialized || typeof window === "undefined" || !config.production || !config.key) return;
  // A production-mode preview is still not the production site.
  if (!["namera.ai", "www.namera.ai", "dashboard.namera.ai"].includes(location.hostname)) return;
  surface = config.surface;
  if (analyticsDisabled()) return;
  // Retire the old in-app preference without overriding browser privacy signals.
  document.cookie =
    "namera_analytics_disabled=; Max-Age=0; Path=/; Domain=namera.ai; Secure; SameSite=Lax";
  posthog.init(config.key, {
    api_host: "https://t.namera.ai",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-05-30",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    enable_recording_console_log: false,
    capture_heatmaps: false,
    capture_performance: { web_vitals: true },
    capture_exceptions: true,
    person_profiles: "identified_only",
    persistence: "localStorage+cookie",
    cross_subdomain_cookie: true,
    secure_cookie: true,
    ip: false,
    disable_surveys_automatic_display: true,
    advanced_only_evaluate_survey_feature_flags: true,
    before_send: (event) => {
      if (!event || analyticsDisabled()) return null;
      if (
        !nativeEvents.has(event.event) &&
        !analyticsEvents.includes(event.event as AnalyticsEvent)
      )
        return null;
      const original = event.properties;
      const safe = sanitizeAnalyticsEvent(event.event, original);
      // Keep workspace analysis available without activating the paid Groups add-on.
      if (workspaceId && surface === "dashboard" && !route.startsWith("/settings/profile")) {
        safe.workspace_id = workspaceId;
        safe.workspace_name = analyticsProfile({ name: workspaceName }).name;
      }
      event.properties = {
        ...safe,
        // The SDK requires its public project token for ingestion, not caller credentials.
        token: config.key,
        surface,
        environment: "production",
        event_version: 1,
        route_template: route,
        $current_url: `${location.origin}${route}`,
        $pathname: route,
        $host: location.hostname,
        $geoip_disable: true,
      };
      return event;
    },
  });
  posthog.clear_opt_in_out_capturing();
  initialized = true;
}

export function captureAnalytics(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  if (!initialized || analyticsDisabled()) return;
  posthog.capture(event, safeAnalyticsProperties(properties));
}

export function analyticsPage(nextRoute: string) {
  route = nextRoute;
  if (!initialized || analyticsDisabled() || lastPage === route) return;
  lastPage = route;
  const publicHeatmap = surface === "web" && ["/", "/pricing"].includes(route);
  posthog.set_config({ capture_heatmaps: publicHeatmap });
  posthog.capture("$pageview");
  clearTimeout(surveyTimer);
  if (!surveyConsidered)
    surveyTimer = setTimeout(() => {
      if (analyticsDisabled() || document.visibilityState !== "visible") return;
      const cookie = document.cookie
        .split("; ")
        .find((value) => value.startsWith("namera_survey_seen="));
      const lastShown = Number(cookie?.split("=")[1] ?? 0);
      if (!surveyEligible(route, lastShown, Date.now(), surveySample)) return;
      surveyConsidered = true;
      const surveyRoute = route;
      posthog.getActiveMatchingSurveys((surveys) => {
        const survey = surveys.find(
          (candidate) =>
            candidate.name.startsWith(`Namera ${surface}:`) && candidate.type === "popover",
        );
        if (
          !survey ||
          route !== surveyRoute ||
          analyticsDisabled() ||
          !surveyEligible(route, lastShown, Date.now(), 0)
        )
          return;
        document.cookie = `namera_survey_seen=${Date.now()}; Max-Age=2592000; Path=/; Domain=namera.ai; Secure; SameSite=Lax`;
        posthog.displaySurvey(survey.id);
      });
    }, 60_000);
}

export function analyticsIdentity(
  nextUser?: string,
  nextWorkspace?: string,
  nextName?: string,
  nextWorkspaceName?: string,
) {
  if (!initialized || analyticsDisabled()) return;
  workspaceId = nextWorkspace;
  workspaceName = nextWorkspaceName;
  if (userId !== nextUser) {
    if (userId) posthog.reset();
    if (nextUser) posthog.identify(nextUser, analyticsProfile({ name: nextName }));
    userId = nextUser;
    profileName = nextName;
  } else if (nextUser && nextName !== profileName) {
    posthog.setPersonProperties(analyticsProfile({ name: nextName }));
    profileName = nextName;
  }
}

export function captureAnalyticsException(error: unknown) {
  if (initialized && !analyticsDisabled()) posthog.captureException(error);
}

/** Do not attribute a completed request to an identity that changed while it was running. */
export function analyticsContext() {
  return `${userId ?? ""}:${workspaceId ?? ""}`;
}
