import { describe, expect, it } from "vitest";

import { sessionCustodyLimits } from "../../../src/routes/_authenticated/session-keys/-components/create-session-key-form/custody-limits";

describe("session custody capacity", () => {
  it("disables only exhausted session custody, independently of account capacity", () => {
    expect(
      sessionCustodyLimits([
        { key: "local-session-keys", includedAmount: 100n, usedAmount: 100n, remainingAmount: 0n },
        { key: "oneclaw-session-keys", includedAmount: 5n, usedAmount: 4n, remainingAmount: 1n },
        { key: "oneclaw-wallets", includedAmount: 3n, usedAmount: 3n, remainingAmount: 0n },
      ]),
    ).toEqual({ local: true, managed: false });
    expect(
      sessionCustodyLimits([
        { key: "oneclaw-session-keys", includedAmount: 0n, usedAmount: 0n, remainingAmount: 0n },
      ]),
    ).toEqual({ local: false, managed: true });
  });
  it("does not invent a limit when billing cannot be read", () => {
    expect(sessionCustodyLimits(undefined)).toEqual({ local: false, managed: false });
  });
});
