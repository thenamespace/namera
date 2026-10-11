import { Context } from "effect";

/** Set at the HTTP/worker boundary, never from unverified request identity. */
export const AnalyticsCollection = Context.Reference<"disabled" | "enabled" | "background">(
  "@namera-ai/telemetry/AnalyticsCollection",
  { defaultValue: (): "disabled" | "enabled" | "background" => "disabled" },
);

export function analyticsOptedOut(headers: Readonly<Record<string, string | undefined>>) {
  return (
    headers.dnt === "1" ||
    headers["sec-gpc"] === "1" ||
    headers["x-namera-analytics"] === "off" ||
    (headers.cookie ?? "").split(/;\s*/).includes("namera_analytics_disabled=true")
  );
}
