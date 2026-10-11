/** Analytics is deliberately separate from audit records and operational telemetry. */
export const analyticsEvents = [
  "cta_clicked",
  "integration_link_clicked",
  "faq_opened",
  "marketing_section_seen",
  "playground_run_completed",
  "playground_option_changed",
  "pricing_cta_clicked",
  "pricing_comparison_plan_selected",
  "waitlist_submitted",
  "waitlist_response_received",
  "waitlist_submit_failed",
  "docs_search_completed",
  "docs_search_result_clicked",
  "docs_code_copied",
  "docs_markdown_copied",
  "docs_package_manager_selected",
  "blog_search_completed",
  "blog_search_result_clicked",
  "page_not_found",
  "dashboard_action_started",
  "dashboard_action_succeeded",
  "dashboard_action_failed",
  "api_operation_completed",
  "analytics_preference_changed",
] as const;

export type AnalyticsEvent = (typeof analyticsEvents)[number];
export type AnalyticsSurface = "web" | "dashboard";
export type AnalyticsProperties = {
  readonly action?: string;
  readonly placement?: string;
  readonly destination?: string;
  readonly section?: string;
  readonly plan?: string;
  readonly outcome?: string;
  readonly result_count?: number;
  readonly query_length?: number;
  readonly result_rank?: number;
  readonly duration_ms?: number;
  readonly error_code?: string;
  readonly method?: string;
  readonly status_code?: number;
  readonly actor_kind?: string;
  readonly workspace_id?: string;
  readonly workspace_name?: string;
  readonly account_id?: string;
  readonly session_key_id?: string;
};

const propertyNames = new Set([
  "action",
  "placement",
  "destination",
  "section",
  "plan",
  "outcome",
  "result_count",
  "query_length",
  "result_rank",
  "duration_ms",
  "error_code",
  "method",
  "status_code",
  "actor_kind",
  "workspace_id",
  "workspace_name",
  "account_id",
  "session_key_id",
]);

export function safeAnalyticsProperties(properties: Readonly<Record<string, unknown>>) {
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!propertyNames.has(key)) continue;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) safe[key] = value;
    else if (typeof value === "boolean") safe[key] = value;
    else if (typeof value === "string" && value.length <= 200)
      safe[key] = redactAnalyticsText(value);
  }
  return safe;
}

/** Defense in depth for explicitly selected labels, never a substitute for excluding payloads. */
export function redactAnalyticsText(value: string) {
  return value
    .replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted]")
    .replace(/\b0x[a-fA-F0-9]{64,}\b/g, "[redacted]")
    .replace(
      /((?:api[_-]?key|token|password|secret|authorization|code)\s*[:=]\s*)[^\s&,;]+/gi,
      "$1[redacted]",
    );
}

/** Router IDs are code-owned; raw paths, query strings and document titles are not. */
export function analyticsRoute(routeId: string) {
  return routeId.replace(/\/_[^/]+/g, "").replace(/\$([a-zA-Z]+)/g, ":$1") || "/";
}

export function surveyEligible(route: string, lastShown: number, now: number, sample: number) {
  return (
    !/(auth|invitations|settings|new|session-key|execution|account\/|privacy|terms)/.test(route) &&
    now - lastShown >= 30 * 24 * 60 * 60 * 1000 &&
    sample < 0.1
  );
}
