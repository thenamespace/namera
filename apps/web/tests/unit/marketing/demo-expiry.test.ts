import { describe, expect, it } from "vitest";

import { formatDemoExpiry } from "../../../src/components/marketing/demo-expiry.js";

describe("demo expiry", () => {
  it.each([
    ["2026-10-06T12:00:00Z", "6 Jan 2027"],
    ["2026-01-31T12:00:00Z", "30 Apr 2026"],
    ["2027-11-30T12:00:00Z", "29 Feb 2028"],
  ])("adds three calendar months to %s", (now, expected) => {
    const today = new Date(now);
    expect(formatDemoExpiry(today)).toBe(expected);
    expect(today.toISOString()).toBe(new Date(now).toISOString());
  });
});
