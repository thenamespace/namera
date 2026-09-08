import { expect, layer } from "@effect/vitest";
import { Effect, Option } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { makeTestEvmExecutionService } from "@namera-ai/evm";
import { EthereumAddress, EvmExecutionError, Hex, UserOperationHash } from "@namera-ai/protocol";

import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";
import { queueExecution } from "./fixture.js";

for (const status of ["reverted", "failed"] as const) {
  const provider = makeTestEvmExecutionService();
  const operationHash = UserOperationHash.make(`0x${"55".repeat(32)}`);
  const fixture = makeOwnerSessionTestFixture({
    sessionSigningMessage: () => Effect.succeed(Hex.make(`0x${"22".repeat(32)}`)),
    completeSessionExecution: (input) =>
      provider
        .sign(input)
        .pipe(Effect.map((signed) => ({ ...signed, userOperationHash: operationHash }))),
    submit: Effect.fnUntraced(function* (input) {
      if (input.signed.userOperationHash === operationHash) {
        return yield* new EvmExecutionError({
          code: "SUBMISSION_UNKNOWN",
          cause: "Lost submission response",
        });
      }
      return yield* provider.submit(input);
    }),
    getStatus: () => Effect.succeed({ status, transactionHash: null }),
    getReceipt: Effect.fnUntraced(function* (input) {
      const receipt = yield* provider.getReceipt(input);
      return Option.map(receipt, (value) => {
        const normalized = {
          ...value,
          sender: EthereumAddress.make("0x3333333333333333333333333333333333333333"),
        };
        return input.userOperationHash === operationHash
          ? { ...normalized, success: false as const, reason: "Execution reverted" }
          : normalized;
      });
    }),
  });

  layer(fixture.layer)(`uncertain submission followed by ${status}`, (it) => {
    it.effect("recovers the failed receipt and settles gas without resubmitting forever", () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail(`uncertain-${status}@example.com`));
        const wallet = yield* createTestPasskeyWallet(client, "Recovery wallet");
        const session = yield* client.sessionKey.create({
          payload: yield* localSessionRequest(wallet.id),
        });
        yield* fixture.confirmOperation(client, session, "install");
        const before = yield* client.billing.get();
        const apiKey = yield* client.apiKey.create({
          payload: {
            metadata: { version: 1, name: "Recovery agent" },
            durationDays: 7,
            sessionKeyIds: [session.id],
          },
        });
        yield* setAuthToken();
        yield* setApiKey(apiKey.key);
        const queued = yield* queueExecution(client, {
          headers: { "idempotency-key": `uncertain-${status}` },
          payload: {
            namespace: "eip155",
            walletId: wallet.id,
            sessionKeyId: session.id,
            chainId: "eip155:1",
            calls: [{ to: wallet.address, value: 0n, data: "0x" }],
          },
        });
        const app = yield* Application;
        yield* TestClock.adjust("2 seconds");
        expect(yield* app.execution.reconcile()).toBe(1);
        expect(
          yield* client.execution.getSubmission({ params: { submissionId: queued.submissionId } }),
        ).toMatchObject({ status: "submitted" });
        yield* TestClock.adjust("16 seconds");
        expect(yield* app.execution.reconcile()).toBe(1);
        expect(
          yield* client.execution.getSubmission({ params: { submissionId: queued.submissionId } }),
        ).toMatchObject({ status: "failed" });
        expect(yield* app.execution.reconcile()).toBe(0);
        yield* setApiKey();
        yield* setAuthToken(owner.cookie.value);
        const after = yield* client.billing.get();
        expect(after.meters.find(({ key }) => key === "execution.mainnet")).toMatchObject({
          consumedAmount: before.meters.find(({ key }) => key === "execution.mainnet")
            ?.consumedAmount,
          reservedAmount: 0n,
        });
        expect(after.meters.find(({ key }) => key === "gas-sponsorship")).toMatchObject({
          consumedAmount:
            (before.meters.find(({ key }) => key === "gas-sponsorship")?.consumedAmount ?? 0n) +
            32_400n,
          reservedAmount: 0n,
        });
      }),
    );
  });
}
