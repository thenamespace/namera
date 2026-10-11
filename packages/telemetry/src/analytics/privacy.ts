import { redactAnalyticsText, safeAnalyticsProperties } from "./contract.js";

const technicalProperties = new Set([
  "distinct_id",
  "$device_id",
  "$session_id",
  "$window_id",
  "$insert_id",
  "$lib",
  "$lib_version",
  "$browser",
  "$browser_version",
  "$os",
  "$os_version",
  "$device_type",
  "$screen_height",
  "$screen_width",
  "$viewport_height",
  "$viewport_width",
  "$time",
  "$is_identified",
  "$pageview_id",
  "$web_vitals_FCP_value",
  "$web_vitals_LCP_value",
  "$web_vitals_INP_value",
  "$web_vitals_CLS_value",
  "$survey_id",
  "$survey_submission_id",
  "$survey_completed",
  "$survey_iteration",
  "$anon_distinct_id",
  "$release_id",
]);
const answers = new Set([
  "Yes",
  "No",
  "Easy",
  "Neutral",
  "Difficult",
  "Documentation",
  "Account setup",
  "Session permissions",
  "Client connection",
  "Something else",
]);

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function analyticsProfile(value: unknown) {
  const profile = record(value);
  return typeof profile.name === "string"
    ? { name: redactAnalyticsText(profile.name.slice(0, 200)) }
    : {};
}

export function analyticsUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return undefined;
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

export function sanitizeAnalyticsEvent(event: string, original: Record<string, unknown>) {
  const safe: Record<string, unknown> = safeAnalyticsProperties(original);
  for (const key of technicalProperties) {
    const value = original[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
      safe[key] = value;
  }
  // Referrer origins retain acquisition context without query tokens or private paths.
  for (const key of ["$referrer", "$initial_referrer"]) {
    const url = analyticsUrl(original[key]);
    if (url) {
      safe[key] = new URL(url).origin;
      safe[key === "$referrer" ? "$referring_domain" : "$initial_referring_domain"] = new URL(
        url,
      ).hostname;
    }
  }
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const value = original[key];
    if (typeof value === "string" && /^[\w .-]{1,100}$/.test(value))
      safe[key] = redactAnalyticsText(value);
  }
  if (event === "$identify" || event === "$set") safe.$set = analyticsProfile(original.$set);
  if (event === "$exception" && Array.isArray(original.$exception_list)) {
    safe.$exception_list = original.$exception_list.map((value) => {
      const exception = record(value);
      const stack = record(exception.stacktrace);
      return {
        type:
          typeof exception.type === "string"
            ? redactAnalyticsText(exception.type.slice(0, 100))
            : "Error",
        value: "Unexpected application error",
        stacktrace: {
          type: "raw",
          frames: Array.isArray(stack.frames)
            ? stack.frames.map((frameValue) => {
                const frame = record(frameValue);
                return {
                  filename: analyticsUrl(frame.filename),
                  lineno: frame.lineno,
                  colno: frame.colno,
                  chunk_id:
                    typeof frame.chunk_id === "string" && /^[\w-]{1,100}$/.test(frame.chunk_id)
                      ? frame.chunk_id
                      : undefined,
                  function:
                    typeof frame.function === "string"
                      ? redactAnalyticsText(frame.function.slice(0, 100))
                      : undefined,
                  platform: "javascript",
                  in_app: frame.in_app,
                };
              })
            : [],
        },
      };
    });
  }
  if (event.startsWith("survey "))
    for (const [key, value] of Object.entries(original)) {
      if (key.startsWith("$survey_response") && typeof value === "string" && answers.has(value))
        safe[key] = value;
    }
  if (event === "$$heatmap") {
    const points: Record<string, unknown[]> = {};
    for (const [url, values] of Object.entries(record(original.$heatmap_data))) {
      const sanitized = analyticsUrl(url);
      if (
        !sanitized ||
        ![
          "https://namera.ai/",
          "https://namera.ai/pricing",
          "https://www.namera.ai/",
          "https://www.namera.ai/pricing",
        ].includes(sanitized) ||
        !Array.isArray(values)
      )
        continue;
      points[sanitized] = values.map((value) => {
        const point = record(value);
        return { x: point.x, y: point.y, target_fixed: point.target_fixed, type: point.type };
      });
    }
    safe.$heatmap_data = points;
  }
  return safe;
}
