import { describe, expect, it } from "vitest";

import {
  gettingStartedMilestones,
  gettingStartedSessionProgress,
  gettingStartedStorageKey,
} from "../../src/lib/getting-started";
import { setupOverview, setupSessionKey } from "../fixtures/getting-started";

describe("getting started milestones", () => {
  it("does not invent progress before the overview is available", () => {
    expect(gettingStartedMilestones(undefined, false)).toEqual([false, false, false, false]);
  });

  it("does not complete the key step from creation counts alone", () => {
    expect(gettingStartedMilestones(setupOverview({ accounts: 1, sessionKeys: 1 }), false)).toEqual(
      [true, false, false, false],
    );
  });

  it("counts a key only after an active session has an installed network", () => {
    const session = setupSessionKey();
    const progress = gettingStartedSessionProgress([session]);
    expect(progress).toEqual({ enabled: true, approvalSessionKey: undefined });
    expect(
      gettingStartedMilestones(setupOverview({ accounts: 1 }), false, progress.enabled),
    ).toEqual([true, true, false, false]);
  });

  it.each(["pending", "submitted", "failed"] as const)(
    "keeps a %s installation incomplete and identifies the key to approve",
    (status) => {
      const session = setupSessionKey(status);
      expect(gettingStartedSessionProgress([session])).toEqual({
        enabled: false,
        approvalSessionKey: session,
      });
    },
  );

  it.each(["revoking", "revoked"] as const)("does not count a %s session", (status) => {
    expect(gettingStartedSessionProgress([{ ...setupSessionKey(), status }])).toEqual({
      enabled: false,
      approvalSessionKey: undefined,
    });
  });

  it("accepts one installed network even if another key still needs approval", () => {
    expect(gettingStartedSessionProgress([setupSessionKey("pending"), setupSessionKey()])).toEqual({
      enabled: true,
      approvalSessionKey: undefined,
    });
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
