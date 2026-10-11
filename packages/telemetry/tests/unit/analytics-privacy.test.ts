import { describe, expect, it } from "vitest";

import {
  analyticsRoute,
  safeAnalyticsProperties,
  surveyEligible,
} from "../../src/analytics/contract.js";
import { analyticsProfile, sanitizeAnalyticsEvent } from "../../src/analytics/privacy.js";

describe("analytics privacy boundary", () => {
  it("keeps IDs and names but excludes unknown properties and request payloads", () => {
    expect(
      safeAnalyticsProperties({
        workspace_id: "0199dfe1-0000-7000-8000-000000000001",
        workspace_name: "Namera team",
        token: "secret",
        payload: { privateKey: "secret" },
        duration_ms: NaN,
      }),
    ).toEqual({
      workspace_id: "0199dfe1-0000-7000-8000-000000000001",
      workspace_name: "Namera team",
    });
    expect(
      analyticsProfile({ name: "Jane Smith", email: "private@example.com", token: "secret" }),
    ).toEqual({ name: "Jane Smith" });
  });

  it("does not forward credentials in URL context, person properties, or exception messages", () => {
    const safe = sanitizeAnalyticsEvent("$exception", {
      $current_url: "https://namera.ai/auth?token=secret",
      $referrer: "https://search.example/private?api_key=secret",
      $set: { token: "secret" },
      $exception_list: [
        {
          type: "TypeError",
          value: "password=secret",
          stacktrace: {
            frames: [
              {
                filename: "https://namera.ai/assets/app.js?token=secret",
                lineno: 12,
                colno: 3,
                vars: { token: "secret" },
                context_line: "secret",
              },
            ],
          },
        },
      ],
    });
    expect(JSON.stringify(safe)).not.toContain("secret");
    expect(safe.$referrer).toBe("https://search.example");
    expect(safe.$exception_list).toMatchObject([
      {
        stacktrace: {
          frames: [{ filename: "https://namera.ai/assets/app.js", lineno: 12, colno: 3 }],
        },
      },
    ]);
  });

  it("redacts pasted credentials in explicitly allowed names", () => {
    expect(analyticsProfile({ name: "token=secret" })).toEqual({ name: "token=[redacted]" });
    expect(analyticsProfile({ name: `0x${"ab".repeat(32)}` })).toEqual({ name: "[redacted]" });
  });

  it("only keeps public heatmap URLs and coordinates", () => {
    const safe = sanitizeAnalyticsEvent("$$heatmap", {
      $heatmap_data: {
        "https://namera.ai/pricing?token=secret": [
          { x: 3, y: 5, type: "click", target_fixed: false, text: "secret" },
        ],
        "https://dashboard.namera.ai/auth": [{ x: 1, y: 2 }],
      },
    });
    expect(safe.$heatmap_data).toEqual({
      "https://namera.ai/pricing": [{ x: 3, y: 5, type: "click", target_fixed: false }],
    });
  });

  it("rejects free-text survey answers", () => {
    expect(
      sanitizeAnalyticsEvent("survey sent", {
        $survey_response: "my secret",
        $survey_response_1: "Yes",
      }),
    ).toEqual({ $survey_response_1: "Yes" });
  });

  it("keeps route templates and respects survey cooldown and sensitive routes", () => {
    expect(analyticsRoute("/_authenticated/account/$accountId/assets")).toBe(
      "/account/:accountId/assets",
    );
    const now = 90 * 86400_000;
    expect(surveyEligible("/docs/sdk", 0, now, 0.05)).toBe(true);
    expect(surveyEligible("/auth", 0, now, 0.05)).toBe(false);
    expect(surveyEligible("/docs/sdk", now - 86400_000, now, 0.05)).toBe(false);
    expect(surveyEligible("/docs/sdk", 0, now, 0.5)).toBe(false);
  });
});
