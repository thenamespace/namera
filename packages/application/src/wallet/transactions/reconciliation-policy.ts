import type { WalletOperation } from "@namera-ai/protocol/model";

type RetryState = NonNullable<WalletOperation["data"]["reconciliation"]>;

export const walletReconciliationPolicy = {
  concurrency: 4,
  leaseSeconds: 120,
  attemptTimeoutSeconds: 60,
} as const;

export const nextWalletReconciliation = (input: {
  readonly previous: RetryState | undefined;
  readonly failed: boolean;
  readonly progressed: boolean;
  readonly slow: boolean;
  readonly random: number;
}) => {
  const attempts = input.progressed ? 1 : (input.previous?.attempts ?? 0) + 1;
  const consecutiveErrors = input.failed ? (input.previous?.consecutiveErrors ?? 0) + 1 : 0;
  const pendingSeconds = Math.min(15 * 2 ** Math.min(attempts - 1, 3), 120);
  const errorSeconds =
    consecutiveErrors === 0 ? 0 : Math.min(30 * 2 ** Math.min(consecutiveErrors - 1, 5), 900);
  const baseSeconds = Math.max(pendingSeconds, errorSeconds, input.slow ? 900 : 0);

  // Bounded jitter spreads polling without allowing zero-delay retry loops.
  const delaySeconds = Math.round(baseSeconds * (0.8 + input.random * 0.4));
  return { reconciliation: { attempts, consecutiveErrors }, delaySeconds };
};
