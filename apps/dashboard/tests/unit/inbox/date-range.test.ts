import { describe, expect, it } from "vitest";

import { inboxDateCutoff } from "../../../src/routes/_authenticated/-components/inbox/date-range";

describe("inbox date range", () => {
  const now = Date.UTC(2026, 9, 15);
  const day = 86_400_000;

  it("removes the cutoff for All time rather than falling back to seven days", () => {
    expect(inboxDateCutoff("all", now)).toBeNull();
  });

  it("retains each rolling window and the default for a missing selection", () => {
    expect(inboxDateCutoff("1d", now)).toBe(now - day);
    expect(inboxDateCutoff("7d", now)).toBe(now - 7 * day);
    expect(inboxDateCutoff("30d", now)).toBe(now - 30 * day);
    expect(inboxDateCutoff(undefined, now)).toBe(now - 7 * day);
  });
});
