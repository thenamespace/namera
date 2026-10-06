import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";

import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { createExecutionFixture, executionFixture, queueExecution } from "./fixture.js";

layer(executionFixture.layer)("execution lease recovery", (it) => {
  for (const stage of ["prepared", "submitted"] as const) {
    it.effect(`recovers an abandoned ${stage} lease and rejects stale writes`, () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail(`lease-${stage}@example.com`));
        const { wallet, sessionKey, apiKey } = yield* createExecutionFixture(client, stage);
        yield* setAuthToken();
        yield* setApiKey(apiKey.key);
        const queued = yield* queueExecution(client, {
          headers: { "idempotency-key": `lease-${stage}` },
          payload: {
            namespace: "eip155",
            walletId: wallet.id,
            sessionKeyId: sessionKey.id,
            chainId: "eip155:1",
            calls: [{ to: wallet.address, value: 0n, data: "0x" }],
          },
        });
        const app = yield* Application;
        const submissions = (yield* Repository).core.executionSubmission;
        yield* TestClock.adjust("2 seconds");
        if (stage === "submitted") {
          expect(yield* app.execution.reconcile()).toBe(1);
          yield* TestClock.adjust("16 seconds");
        }
        const now = yield* DateTime.now;
        const abandoned = yield* submissions.claimForReconciliation({
          now,
          leaseToken: "abandoned-worker",
          leaseExpiresAt: DateTime.addDuration(now, Duration.minutes(2)),
          limit: 1,
        });
        expect(abandoned).toMatchObject([{ id: queued.submissionId, status: stage }]);
        expect(yield* app.execution.reconcile()).toBe(0);

        // The worker disappears without releasing its durable claim.
        yield* TestClock.adjust("2 minutes");
        const recoveredAt = yield* DateTime.now;
        const recovered = yield* submissions.claimForReconciliation({
          now: recoveredAt,
          leaseToken: "replacement-worker",
          leaseExpiresAt: DateTime.addDuration(recoveredAt, Duration.minutes(2)),
          limit: 1,
        });
        expect(recovered).toMatchObject([
          { id: queued.submissionId, status: stage, leaseToken: "replacement-worker" },
        ]);
        const identity = { id: queued.submissionId, organizationId: owner.actor.organization.id };
        expect(
          yield* submissions.markFailed({
            ...identity,
            failedAt: recoveredAt,
            leaseToken: "abandoned-worker",
          }),
        ).toBeUndefined();
        expect(
          yield* submissions.markConfirmed({
            ...identity,
            confirmedAt: recoveredAt,
            leaseToken: "abandoned-worker",
          }),
        ).toBeUndefined();
        expect(
          yield* submissions.releaseLease({
            ...identity,
            nextReconcileAt: recoveredAt,
            leaseToken: "abandoned-worker",
          }),
        ).toBeUndefined();
        expect(
          yield* submissions.releaseLease({
            ...identity,
            nextReconcileAt: recoveredAt,
            leaseToken: "replacement-worker",
          }),
        ).toBeDefined();

        expect(yield* app.execution.reconcile()).toBe(1);
        if (stage === "prepared") {
          yield* TestClock.adjust("16 seconds");
          expect(yield* app.execution.reconcile()).toBe(1);
        }
        expect(
          yield* client.execution.getSubmission({ params: { submissionId: queued.submissionId } }),
        ).toMatchObject({ status: "confirmed" });
        expect(yield* app.execution.reconcile()).toBe(0);
        yield* setApiKey();
        yield* setAuthToken(owner.cookie.value);
        yield* app.billing.reconcile();
        const billing = yield* client.billing.get();
        expect(billing.meters.find(({ key }) => key === "execution.mainnet")).toMatchObject({
          consumedAmount: 2n,
          reservedAmount: 0n,
        });
        expect(billing.meters.find(({ key }) => key === "gas-sponsorship")).toMatchObject({
          consumedAmount: 32_400n,
          reservedAmount: 0n,
        });
        const events = yield* (yield* Repository).audit.organization.findForOrganization(
          owner.actor.organization.id,
        );
        expect(events.filter(({ event }) => event === "execution.confirmed")).toHaveLength(1);
      }),
    );
  }
});
