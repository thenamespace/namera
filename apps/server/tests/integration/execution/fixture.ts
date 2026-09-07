import { DateTime, Duration, Effect } from "effect";

import type { WalletResponse } from "@namera-ai/protocol/dto";

import type { TestApiClient } from "../../fixtures/api.js";

const metadata = (name: string) => ({ version: 1 as const, name });

export const createExecutionFixture = Effect.fn("test.execution.createFixture")(function* (
  client: TestApiClient,
  suffix: string,
) {
  const wallet = yield* client.wallet.create({
    payload: {
      namespace: "eip155",
      owner: { type: "namera-managed", protectionLevel: "software" },
      metadata: metadata(`Treasury ${suffix}`),
    },
  });
  const sessionKey = yield* client.sessionKey.create({
    payload: {
      namespace: "eip155",
      walletId: wallet.id,
      metadata: metadata(`Automation ${suffix}`),
      policies: [
        {
          type: "evm.time-window",
          version: 1,
          startsAt: null,
          expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.days(1)),
        },
      ],
    },
  });
  const apiKey = yield* client.apiKey.create({
    payload: {
      metadata: metadata(`Agent ${suffix}`),
      durationDays: 7,
      sessionKeyIds: [sessionKey.id],
    },
  });
  return { wallet, sessionKey, apiKey } as const;
});

export const executeFixture = (
  client: TestApiClient,
  wallet: WalletResponse,
  idempotencyKey: string,
) =>
  client.execution.execute({
    headers: { "idempotency-key": idempotencyKey },
    payload: {
      namespace: "eip155",
      walletId: wallet.id,
      chainId: "eip155:1",
      calls: [{ to: wallet.address, value: 0n, data: "0x" }],
    },
  });
