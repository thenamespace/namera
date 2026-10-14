import { expect, it } from "vitest";

import { nextWalletReconciliation } from "../../../src/wallet/transactions/reconciliation-policy.js";

const defaults = {
  previous: undefined,
  failed: false,
  progressed: false,
  slow: false,
  random: 0.5,
} as const;

it("backs off pending polls exponentially and caps them", () => {
  let previous: ReturnType<typeof nextWalletReconciliation>["reconciliation"] | undefined;
  const delays = [];
  for (let index = 0; index < 7; index++) {
    const retry = nextWalletReconciliation({ ...defaults, previous });
    previous = retry.reconciliation;
    delays.push(retry.delaySeconds);
  }
  expect(delays).toEqual([15, 30, 60, 120, 120, 120, 120]);
});

it("backs off consecutive failures separately and resets them after a healthy check", () => {
  let previous: ReturnType<typeof nextWalletReconciliation>["reconciliation"] | undefined;
  const delays = [];
  for (let index = 0; index < 8; index++) {
    const retry = nextWalletReconciliation({ ...defaults, previous, failed: true });
    previous = retry.reconciliation;
    delays.push(retry.delaySeconds);
  }
  expect(delays).toEqual([30, 60, 120, 240, 480, 900, 900, 900]);
  expect(nextWalletReconciliation({ ...defaults, previous })).toEqual({
    reconciliation: { attempts: 9, consecutiveErrors: 0 },
    delaySeconds: 120,
  });
});

it("resets pending cadence on progress and bounds jitter and long-term polling", () => {
  const previous = { attempts: 32, consecutiveErrors: 32 };
  expect(nextWalletReconciliation({ ...defaults, previous, progressed: true }).delaySeconds).toBe(
    15,
  );
  for (const random of [0, 1]) {
    const retry = nextWalletReconciliation({ ...defaults, previous, slow: true, random });
    expect(retry.delaySeconds).toBe(random === 0 ? 720 : 1080);
    expect(retry.reconciliation.attempts).toBe(33);
  }
});
