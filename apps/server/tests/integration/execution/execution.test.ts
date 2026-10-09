import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import { TestEvmExecution } from "@namera-ai/evm";

import { executionFixture, executeRequest, queueExecution } from "../../fixtures/execution.js";
import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";

const metadata = (name: string) => ({ version: 1 as const, name });

layer(executionFixture.layer)("execution routes", (it) => {
  it.effect(
    "simulates calls and policy eligibility without consuming limits or billing usage",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail("execution-simulation@example.com"));
        const wallet = yield* createTestPasskeyWallet(client, "Simulation treasury");
        const sessionKey = yield* client.sessionKey.create({
          payload: {
            ...(yield* localSessionRequest(wallet.id)),
            metadata: metadata("Simulation agent"),
            policies: [
              {
                type: "evm.time-window",
                version: 1,
                startsAt: null,
                expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.days(1)),
              },
              {
                type: "evm.native-spend-limit",
                version: 1,
                limits: [{ chainId: "eip155:1", period: "lifetime", maxAmount: 1n }],
              },
            ],
          },
        });
        const spendPolicy = sessionKey.policies.find(
          (policy) => policy.type === "evm.native-spend-limit",
        );
        if (spendPolicy === undefined) return yield* Effect.die("Expected spend policy");
        expect(
          (yield* executionFixture.confirmOperation(client, sessionKey, "install")).status,
        ).toBe("active");
        const apiKey = yield* client.apiKey.create({
          payload: {
            metadata: metadata("Simulation API key"),
            durationDays: 7,
            sessionKeyIds: [sessionKey.id],
          },
        });
        yield* setAuthToken();
        yield* setApiKey(apiKey.key);

        const simulate = (value: bigint) =>
          client.execution.simulate({
            payload: {
              namespace: "eip155",
              walletId: wallet.id,
              sessionKeyId: sessionKey.id,
              chainId: "eip155:1",
              calls: [{ to: wallet.address, value, data: "0x" }],
            },
          });

        const allowed = yield* simulate(1n);
        expect(allowed).toMatchObject({
          namespace: "eip155",
          walletId: wallet.id,
          sessionKeyId: sessionKey.id,
          chainId: "eip155:1",
          account: wallet.address,
          callsSucceeded: true,
          allowed: true,
        });
        const denied = yield* simulate(2n);
        expect(denied).toMatchObject({
          callsSucceeded: true,
          allowed: false,
          denials: [
            {
              sessionKeyId: sessionKey.id,
              policyId: spendPolicy.id,
              code: "NATIVE_SPEND_LIMIT_EXCEEDED",
            },
          ],
        });

        const repository = yield* Repository;
        expect(
          yield* repository.core.sessionKeyPolicyState.findForPolicy(
            owner.actor.organization.id,
            sessionKey.id,
            spendPolicy.id,
          ),
        ).toEqual([]);
        yield* setApiKey();
        yield* setAuthToken(owner.cookie.value);
        expect(
          (yield* client.billing.get()).meters.find(({ key }) => key === "execution.mainnet")
            ?.consumedAmount,
        ).toBe(1n);
      }),
  );

  it.effect(
    "authenticates an API key, settles policy state, and returns an idempotent receipt",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail("execution-owner@example.com"));
        // Execution confirmations remain in-app only, even with an email preference.
        yield* client.notification.updatePreference({
          payload: {
            organizationId: owner.actor.organization.id,
            category: "organization",
            topic: "executions",
            channel: "email",
            enabled: true,
          },
        });
        const wallet = yield* createTestPasskeyWallet(client, "Treasury");
        const sessionKey = yield* client.sessionKey.create({
          payload: {
            ...(yield* localSessionRequest(wallet.id)),
            metadata: metadata("Treasury automation"),
            policies: [
              {
                type: "evm.time-window",
                version: 1,
                startsAt: null,
                expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.days(1)),
              },
              {
                type: "evm.native-spend-limit",
                version: 1,
                limits: [{ chainId: "eip155:1", period: "lifetime", maxAmount: 10n }],
              },
            ],
          },
        });
        expect(
          (yield* executionFixture.confirmOperation(client, sessionKey, "install")).status,
        ).toBe("active");
        const apiKey = yield* client.apiKey.create({
          payload: {
            metadata: metadata("Execution agent"),
            durationDays: 7,
            sessionKeyIds: [sessionKey.id],
          },
        });
        yield* setAuthToken();
        yield* setApiKey(apiKey.key);

        const request = {
          headers: { "idempotency-key": "execution-1" },
          payload: {
            namespace: "eip155" as const,
            walletId: wallet.id,
            sessionKeyId: sessionKey.id,
            chainId: "eip155:1" as const,
            calls: [
              {
                to: wallet.address,
                value: 4n,
                data: "0x" as const,
              },
            ],
          },
        };
        const result = yield* executeRequest(client, request);
        expect(result.status).toBe("confirmed");
        if (result.status !== "confirmed") return yield* Effect.die("Expected a receipt");
        expect(result.receipt.success).toBe(true);
        const replay = yield* executeRequest(client, request);
        if (replay.status !== "confirmed") return yield* Effect.die("Expected a receipt");
        expect(replay.executionId).toBe(result.executionId);
        const explicitSponsoredReplay = yield* executeRequest(client, {
          ...request,
          payload: { ...request.payload, sponsor: true },
        });
        if (explicitSponsoredReplay.status !== "confirmed") {
          return yield* Effect.die("Expected a receipt");
        }
        expect(explicitSponsoredReplay.executionId).toBe(result.executionId);

        const unsponsored = yield* executeRequest(client, {
          headers: { "idempotency-key": "execution-unsponsored" },
          payload: {
            ...request.payload,
            sponsor: false,
            calls: [{ to: wallet.address, value: 0n, data: "0x" }],
          },
        });
        expect(unsponsored.status).toBe("confirmed");

        const repository = yield* Repository;
        expect(
          yield* repository.core.execution.findById(
            result.executionId,
            owner.actor.organization.id,
          ),
        ).toMatchObject({
          executionSubmissionId: result.submissionId,
        });
        const nativeSpendLimit = sessionKey.policies.find(
          (policy) => policy.type === "evm.native-spend-limit",
        );
        if (nativeSpendLimit === undefined) {
          return yield* Effect.die("Expected a native spend limit policy");
        }
        const states = yield* repository.core.sessionKeyPolicyState.findForPolicy(
          owner.actor.organization.id,
          sessionKey.id,
          nativeSpendLimit.id,
        );
        expect(states[0]?.data).toEqual({ version: 1, spent: "4", reserved: "0" });
        yield* setApiKey();
        yield* setAuthToken(owner.cookie.value);
        yield* (yield* Application).billing.reconcile();
        const billing = yield* client.billing.get();
        expect(billing.meters.find(({ key }) => key === "execution.mainnet")?.consumedAmount).toBe(
          3n,
        );
        expect(billing.meters.find(({ key }) => key === "gas-sponsorship")?.consumedAmount).toBe(
          32_400n,
        );
        expect(
          (yield* repository.audit.organization.findForOrganization(
            owner.actor.organization.id,
          )).some(({ event }) => event === "execution.confirmed"),
        ).toBe(true);

        const notifications = yield* repository.notification.inbox.listForUser({
          userId: owner.actor.user.id,
          limit: 30,
          now: yield* DateTime.now,
        });
        const confirmation = notifications.find(
          ({ notification }) =>
            notification.type === "execution.confirmed" &&
            notification.resourceId === result.executionId,
        );
        expect(confirmation).toBeDefined();
        expect(confirmation?.recipient.emailJobId).toBeNull();
        expect(confirmation?.notification.data).toMatchObject({
          chainId: "eip155:1",
          transactionHash: result.receipt.transactionHash,
        });
      }),
  );

  it.effect("rejects missing grants, denied policies, and conflicting idempotency requests", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("execution-denied@example.com"));
      const wallet = yield* createTestPasskeyWallet(client, "Restricted");
      const sessionKey = yield* client.sessionKey.create({
        payload: {
          ...(yield* localSessionRequest(wallet.id)),
          metadata: metadata("Restricted key"),
          policies: [
            {
              type: "evm.time-window",
              version: 1,
              startsAt: null,
              expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.days(1)),
            },
            {
              type: "evm.native-spend-limit",
              version: 1,
              limits: [{ chainId: "eip155:1", period: "lifetime", maxAmount: 1n }],
            },
          ],
        },
      });
      expect((yield* executionFixture.confirmOperation(client, sessionKey, "install")).status).toBe(
        "active",
      );
      const apiKey = yield* client.apiKey.create({
        payload: {
          metadata: metadata("Restricted agent"),
          durationDays: 7,
          sessionKeyIds: [sessionKey.id],
        },
      });
      yield* setAuthToken();
      yield* setApiKey(apiKey.key);
      const execute = (value: bigint, idempotencyKey: string) =>
        executeRequest(client, {
          headers: { "idempotency-key": idempotencyKey },
          payload: {
            namespace: "eip155",
            walletId: wallet.id,
            sessionKeyId: sessionKey.id,
            chainId: "eip155:1",
            calls: [{ to: wallet.address, value, data: "0x" }],
          },
        });

      expect(yield* execute(2n, "denied").pipe(Effect.flip)).toMatchObject({
        _tag: "ExecutionError",
        code: "POLICY_DENIED",
        policyCode: "NATIVE_SPEND_LIMIT_EXCEEDED",
      });
      yield* execute(1n, "same-key");
      expect(yield* execute(0n, "same-key").pipe(Effect.flip)).toMatchObject({
        _tag: "ExecutionError",
        code: "IDEMPOTENCY_CONFLICT",
      });
    }),
  );

  it.effect("settles locally signed executions once across competing workers", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const testExecution = yield* TestEvmExecution;
      yield* testExecution.setReceiptMode("pending");
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("execution-worker@example.com"));
      const wallet = yield* createTestPasskeyWallet(client, "Worker treasury");
      const sessionKey = yield* client.sessionKey.create({
        payload: {
          ...(yield* localSessionRequest(wallet.id)),
          metadata: metadata("Worker automation"),
          policies: [
            {
              type: "evm.time-window",
              version: 1,
              startsAt: null,
              expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.days(1)),
            },
            {
              type: "evm.native-spend-limit",
              version: 1,
              limits: [{ chainId: "eip155:1", period: "lifetime", maxAmount: 10n }],
            },
          ],
        },
      });
      expect((yield* executionFixture.confirmOperation(client, sessionKey, "install")).status).toBe(
        "active",
      );
      const apiKey = yield* client.apiKey.create({
        payload: {
          metadata: metadata("Worker agent"),
          durationDays: 7,
          sessionKeyIds: [sessionKey.id],
        },
      });
      yield* setAuthToken();
      yield* setApiKey(apiKey.key);
      const submitted = yield* queueExecution(client, {
        headers: { "idempotency-key": "worker-execution" },
        payload: {
          namespace: "eip155",
          walletId: wallet.id,
          sessionKeyId: sessionKey.id,
          chainId: "eip155:1",
          calls: [{ to: wallet.address, value: 4n, data: "0x" }],
        },
      });
      expect(submitted.status).toBe("prepared");
      const second = yield* queueExecution(client, {
        headers: { "idempotency-key": "worker-execution-2" },
        payload: {
          namespace: "eip155",
          walletId: wallet.id,
          sessionKeyId: sessionKey.id,
          chainId: "eip155:1",
          calls: [{ to: wallet.address, value: 0n, data: "0x" }],
        },
      });
      expect(second.status).toBe("prepared");

      const app = yield* Application;
      yield* TestClock.adjust(Duration.seconds(2));
      const submissions = yield* Effect.all(
        Array.from({ length: 8 }, () => app.execution.reconcile()),
        { concurrency: "unbounded" },
      );
      expect(submissions.reduce((total, count) => total + count, 0)).toBe(2);
      yield* TestClock.adjust(Duration.seconds(16));
      const settlements = yield* Effect.all(
        Array.from({ length: 8 }, () => app.execution.reconcile()),
        { concurrency: "unbounded" },
      );
      expect(settlements.reduce((total, count) => total + count, 0)).toBe(2);
      expect(yield* app.execution.reconcile()).toBe(0);
      const billingSettlements = yield* Effect.all(
        Array.from({ length: 4 }, () => app.billing.reconcile()),
        { concurrency: "unbounded" },
      );
      expect(billingSettlements.reduce((total, result) => total + result.recovered, 0)).toBe(2);

      const repository = yield* Repository;
      expect(
        yield* repository.core.executionSubmission.findById(
          submitted.submissionId,
          owner.actor.organization.id,
        ),
      ).toMatchObject({ status: "confirmed", leaseToken: null, leaseExpiresAt: null });
      expect(
        yield* repository.core.execution.findBySubmissionId(
          submitted.submissionId,
          owner.actor.organization.id,
        ),
      ).toBeDefined();
      expect(
        yield* repository.core.execution.findBySubmissionId(
          second.submissionId,
          owner.actor.organization.id,
        ),
      ).toBeDefined();
      const events = yield* repository.audit.organization.findForOrganization(
        owner.actor.organization.id,
      );
      expect(events.filter(({ event }) => event === "execution.confirmed")).toHaveLength(2);
      const spendPolicy = sessionKey.policies.find(
        (policy) => policy.type === "evm.native-spend-limit",
      );
      if (spendPolicy === undefined) return yield* Effect.die("Expected spend policy");
      expect(
        yield* repository.core.sessionKeyPolicyState.findForPolicy(
          owner.actor.organization.id,
          sessionKey.id,
          spendPolicy.id,
        ),
      ).toMatchObject([{ data: { version: 1, spent: "4", reserved: "0" } }]);
      yield* setApiKey();
      yield* setAuthToken(owner.cookie.value);
      const billing = yield* client.billing.get();
      expect(billing.meters.find(({ key }) => key === "execution.mainnet")).toMatchObject({
        consumedAmount: 3n,
        reservedAmount: 0n,
      });
      expect(billing.meters.find(({ key }) => key === "gas-sponsorship")).toMatchObject({
        consumedAmount: 64_800n,
        reservedAmount: 0n,
      });
      yield* testExecution.setReceiptMode("immediate");
    }),
  );

  it.effect("releases policy reservations after a definitive receipt failure", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const testExecution = yield* TestEvmExecution;
      yield* testExecution.setReceiptMode("pending");
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("execution-worker-failed@example.com"));
      const wallet = yield* createTestPasskeyWallet(client, "Failed worker treasury");
      const sessionKey = yield* client.sessionKey.create({
        payload: {
          ...(yield* localSessionRequest(wallet.id)),
          metadata: metadata("Failed worker automation"),
          policies: [
            {
              type: "evm.time-window",
              version: 1,
              startsAt: null,
              expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.days(1)),
            },
            {
              type: "evm.native-spend-limit",
              version: 1,
              limits: [{ chainId: "eip155:1", period: "lifetime", maxAmount: 10n }],
            },
          ],
        },
      });
      expect((yield* executionFixture.confirmOperation(client, sessionKey, "install")).status).toBe(
        "active",
      );
      const apiKey = yield* client.apiKey.create({
        payload: {
          metadata: metadata("Failed worker agent"),
          durationDays: 7,
          sessionKeyIds: [sessionKey.id],
        },
      });
      yield* setAuthToken();
      yield* setApiKey(apiKey.key);
      const submitted = yield* queueExecution(client, {
        headers: { "idempotency-key": "worker-failed-execution" },
        payload: {
          namespace: "eip155",
          walletId: wallet.id,
          sessionKeyId: sessionKey.id,
          chainId: "eip155:1",
          calls: [{ to: wallet.address, value: 4n, data: "0x" }],
        },
      });
      yield* TestClock.adjust(Duration.seconds(2));
      yield* (yield* Application).execution.reconcile();
      yield* TestClock.adjust(Duration.seconds(16));
      yield* testExecution.setReceiptMode("failed");
      const app = yield* Application;
      expect(yield* app.execution.reconcile()).toBe(1);

      const repository = yield* Repository;
      expect(
        yield* repository.core.executionSubmission.findById(
          submitted.submissionId,
          owner.actor.organization.id,
        ),
      ).toMatchObject({ status: "failed", leaseToken: null, leaseExpiresAt: null });
      expect(
        yield* repository.core.execution.findBySubmissionId(
          submitted.submissionId,
          owner.actor.organization.id,
        ),
      ).toBeUndefined();
      expect(
        yield* client.execution.getSubmission({
          params: { submissionId: submitted.submissionId },
        }),
      ).toMatchObject({ status: "failed", submissionId: submitted.submissionId });
      const spendPolicy = sessionKey.policies.find(
        (policy) => policy.type === "evm.native-spend-limit",
      );
      if (spendPolicy === undefined) return yield* Effect.die("Expected spend policy");
      expect(
        yield* repository.core.sessionKeyPolicyState.findForPolicy(
          owner.actor.organization.id,
          sessionKey.id,
          spendPolicy.id,
        ),
      ).toMatchObject([{ data: { version: 1, spent: "0", reserved: "0" } }]);
      yield* (yield* Application).billing.reconcile();
      const period = yield* repository.billing.period.findOpen(owner.actor.organization.id);
      if (period === undefined) return yield* Effect.die("Expected billing period");
      expect(
        yield* repository.billing.meterBalance.find(
          owner.actor.organization.id,
          period.id,
          "execution.mainnet",
        ),
      ).toMatchObject({ consumedAmount: 1n, reservedAmount: 0n });
      expect(
        yield* repository.billing.meterBalance.find(
          owner.actor.organization.id,
          period.id,
          "gas-sponsorship",
        ),
      ).toMatchObject({ consumedAmount: 32_400n, reservedAmount: 0n });
      yield* testExecution.setReceiptMode("immediate");
    }),
  );
});
