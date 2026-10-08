import { DateTime, Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { makeTestEvmExecutionService } from "@namera-ai/evm";
import { EvmExecutionError, Hex } from "@namera-ai/protocol";
import type { SessionKeyResponse, WalletResponse } from "@namera-ai/protocol/dto";

import type { TestApiClient } from "./api.js";
import { createTestPasskeyWallet, localSessionRequest } from "./local-session.js";
import { makeOwnerSessionTestFixture } from "./owner-session.js";

const metadata = (name: string) => ({ version: 1 as const, name });
const execution = makeTestEvmExecutionService();
const acceptedSignature = Hex.make(`0x${"11".repeat(64)}1b`);

// Provider-only substitute: route tests exercise authority, policies, metering,
// and recovery. Real signature/envelope verification belongs to EVM tests.
export const executionFixture = makeOwnerSessionTestFixture({
  sessionSigningMessage: () => Effect.succeed(Hex.make(`0x${"22".repeat(32)}`)),
  completeSessionExecution: (input) =>
    input.signature === acceptedSignature
      ? execution.sign(input)
      : Effect.fail(
          new EvmExecutionError({ code: "SIGNING_FAILED", cause: "Invalid test signature" }),
        ),
});

export const queueExecution = Effect.fn("test.execution.queue")(function* (
  client: TestApiClient,
  request: Parameters<TestApiClient["execution"]["prepare"]>[0],
) {
  const prepared = yield* client.execution.prepare(request);
  return yield* client.execution.complete({
    payload: {
      namespace: "eip155",
      submissionId: prepared.submissionId,
      signature: acceptedSignature,
    },
  });
});

export const executeRequest = Effect.fn("test.execution.execute")(function* (
  client: TestApiClient,
  request: Parameters<TestApiClient["execution"]["prepare"]>[0],
) {
  const queued = yield* queueExecution(client, request);
  const app = yield* Application;
  yield* TestClock.adjust(Duration.seconds(2));
  yield* app.execution.reconcile();
  yield* TestClock.adjust(Duration.seconds(16));
  yield* app.execution.reconcile();
  const result = yield* client.execution.getSubmission({
    params: { submissionId: queued.submissionId },
  });
  return result.status === "confirmed"
    ? { ...result, executionId: result.execution.id, receipt: result.execution.data.receipt }
    : result;
});

export const createExecutionFixture = Effect.fn("test.execution.createFixture")(function* (
  client: TestApiClient,
  suffix: string,
) {
  const [existingWallet] = yield* client.wallet.list();
  const wallet = existingWallet ?? (yield* createTestPasskeyWallet(client, `Treasury ${suffix}`));
  const sessionKey = yield* client.sessionKey.create({
    payload: {
      ...(yield* localSessionRequest(wallet.id)),
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
  yield* executionFixture.confirmOperation(client, sessionKey, "install");
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
  fixture: { readonly wallet: WalletResponse; readonly sessionKey: SessionKeyResponse },
  idempotencyKey: string,
) =>
  executeRequest(client, {
    headers: { "idempotency-key": idempotencyKey },
    payload: {
      namespace: "eip155",
      walletId: fixture.wallet.id,
      sessionKeyId: fixture.sessionKey.id,
      chainId: "eip155:1",
      calls: [{ to: fixture.wallet.address, value: 0n, data: "0x" }],
    },
  });
