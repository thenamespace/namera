import { describe, expect, it } from "vitest";

import { gettingStartedMilestones, gettingStartedStorageKey } from "../../src/lib/getting-started";
import { setupOverview } from "../fixtures/getting-started";

describe("getting started milestones", () => {
  it("does not invent progress before the overview is available", () => {
    expect(gettingStartedMilestones(undefined, false)).toEqual([false, false, false, false]);
  });

  it("tracks wallet and session creation separately from connection and activity", () => {
    expect(gettingStartedMilestones(setupOverview({ accounts: 1, sessionKeys: 1 }), false)).toEqual(
      [true, true, false, false],
    );
  });

  it("counts a used integration independently of any transaction", () => {
    expect(gettingStartedMilestones(setupOverview(), true)).toEqual([false, false, true, false]);
  });

  it.each(["api-key", "cli", "mcp"] as const)(
    "recognizes confirmed %s execution as connection evidence",
    (source) => {
      expect(gettingStartedMilestones(setupOverview({ executions: 1, source }), false)).toEqual([
        false,
        false,
        true,
        true,
      ]);
    },
  );

  it("does not treat a dashboard owner transaction as an external connection", () => {
    expect(gettingStartedMilestones(setupOverview({ executions: 1 }), false)).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  it("accepts a successful signature without requiring a transaction", () => {
    expect(gettingStartedMilestones(setupOverview({ signatures: 1 }), false)).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  it("isolates dismissal by both user and workspace", () => {
    const original = gettingStartedStorageKey("user-a", "workspace-a");
    expect(gettingStartedStorageKey("user-b", "workspace-a")).not.toBe(original);
    expect(gettingStartedStorageKey("user-a", "workspace-b")).not.toBe(original);
  });
});
