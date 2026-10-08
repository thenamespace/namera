import { expect, layer } from "@effect/vitest";
import { Clock, Context, Effect, Option } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import { makeTestEvmExecutionService } from "@namera-ai/evm";
import { EthereumAddress, EvmExecutionError, Hex, UserOperationHash } from "@namera-ai/protocol";

import { queueExecution } from "../../fixtures/execution.js";
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

const receiptVisible = Context.Reference<boolean>("test/hashMismatch/receiptVisible", {
  defaultValue: () => false,
});
const rejectRetry = Context.Reference<boolean>("test/hashMismatch/rejectRetry", {
  defaultValue: () => false,
});
const forbidBroadcast = Context.Reference<boolean>("test/hashMismatch/forbidBroadcast", {
  defaultValue: () => false,
});
const operationHash = UserOperationHash.make(`0x${"55".repeat(32)}`);
const provider = makeTestEvmExecutionService();
const fixture = makeOwnerSessionTestFixture({
  sessionSigningMessage: () => Effect.succeed(Hex.make(`0x${"22".repeat(32)}`)),
  completeSessionExecution: (input) =>
    provider
      .sign(input)
      .pipe(Effect.map((signed) => ({ ...signed, userOperationHash: operationHash }))),
  submit: Effect.fnUntraced(function* (input) {
    if (input.signed.userOperationHash !== operationHash) return yield* provider.submit(input);
    if (yield* forbidBroadcast) return yield* Effect.die("Rebroadcast after lifetime expired");
    return yield* new EvmExecutionError({
      code: (yield* rejectRetry) ? "SUBMISSION_REJECTED" : "SUBMISSION_HASH_MISMATCH",
      cause: "Provider accepted the operation but returned a different hash",
    });
  }),
  getStatus: Effect.fnUntraced(function* () {
    return {
      status: (yield* receiptVisible) ? ("included" as const) : ("not_found" as const),
      transactionHash: null,
    };
  }),
  getReceipt: Effect.fnUntraced(function* (input) {
    if (input.userOperationHash === operationHash && !(yield* receiptVisible)) return Option.none();
    return yield* provider.getReceipt(input).pipe(
      Effect.map((receipt) =>
        Option.map(receipt, (value) => ({
          ...value,
          sender: EthereumAddress.make("0x3333333333333333333333333333333333333333"),
        })),
      ),
    );
  }),
});

layer(fixture.layer)("mismatched submission response", (it) => {
  it.effect(
    "keeps holds while the canonical hash is not visible and settles a later matching receipt once",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(yield* TestClock.withLive(Clock.currentTimeMillis));
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail("hash-mismatch@example.com"));
        const wallet = yield* createTestPasskeyWallet(client, "Hash recovery");
        const session = yield* client.sessionKey.create({
          payload: yield* localSessionRequest(wallet.id),
        });
        yield* fixture.confirmOperation(client, session, "install");
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
          headers: { "idempotency-key": "hash-mismatch" },
          payload: {
            namespace: "eip155",
            walletId: wallet.id,
            sessionKeyId: session.id,
            chainId: "eip155:1",
            calls: [{ to: wallet.address, value: 0n, data: "0x" }],
          },
        });
        const app = yield* Application;
        const repository = yield* Repository;
        yield* TestClock.adjust("2 seconds");
        expect(yield* app.execution.reconcile()).toBe(1);
        expect(
          yield* client.execution.getSubmission({ params: { submissionId: queued.submissionId } }),
        ).toMatchObject({ status: "prepared" });
        const holds = yield* repository.billing.usageReservation.listBySource(
          owner.actor.organization.id,
          "execution-submission",
          queued.submissionId,
        );
        expect(holds).toHaveLength(2);
        expect(holds.every((hold) => hold.status === "active")).toBe(true);
        expect(yield* app.execution.reconcile()).toBe(0);

        yield* TestClock.adjust("16 seconds");
        expect(
          yield* app.execution.reconcile().pipe(Effect.provideService(rejectRetry, true)),
        ).toBe(1);
        expect(
          yield* repository.core.executionSubmission.findById(
            queued.submissionId,
            owner.actor.organization.id,
          ),
        ).toMatchObject({ status: "prepared", data: { broadcastAttempted: true } });
        expect(
          (yield* repository.billing.usageReservation.listBySource(
            owner.actor.organization.id,
            "execution-submission",
            queued.submissionId,
          )).every((hold) => hold.status === "active"),
        ).toBe(true);

        yield* TestClock.adjust("24 hours");
        expect(
          yield* app.execution.reconcile().pipe(Effect.provideService(forbidBroadcast, true)),
        ).toBe(1);
        expect(
          (yield* repository.billing.usageReservation.listBySource(
            owner.actor.organization.id,
            "execution-submission",
            queued.submissionId,
          )).every((hold) => hold.status === "active"),
        ).toBe(true);
        yield* TestClock.adjust("16 seconds");
        expect(yield* app.execution.reconcile()).toBe(0);
        yield* TestClock.adjust("5 minutes");
        expect(
          yield* app.execution
            .reconcile()
            .pipe(
              Effect.provideService(receiptVisible, true),
              Effect.provideService(forbidBroadcast, true),
            ),
        ).toBe(1);
        expect(
          yield* client.execution.getSubmission({ params: { submissionId: queued.submissionId } }),
        ).toMatchObject({ status: "submitted" });
        yield* TestClock.adjust("16 seconds");
        expect(
          yield* app.execution.reconcile().pipe(Effect.provideService(receiptVisible, true)),
        ).toBe(1);
        expect(
          yield* client.execution.getSubmission({ params: { submissionId: queued.submissionId } }),
        ).toMatchObject({ status: "confirmed" });
        expect(yield* app.execution.reconcile()).toBe(0);
        expect(yield* app.billing.reconcile()).toMatchObject({ recovered: 1 });
        expect(
          (yield* repository.billing.usageReservation.listBySource(
            owner.actor.organization.id,
            "execution-submission",
            queued.submissionId,
          )).every((hold) => hold.status === "settled"),
        ).toBe(true);
        const events = yield* repository.audit.organization.findForOrganization(
          owner.actor.organization.id,
        );
        expect(events.filter((event) => event.event === "execution.confirmed")).toHaveLength(1);
        expect(events.filter((event) => event.event === "execution.failed")).toHaveLength(0);
      }),
  );
});
