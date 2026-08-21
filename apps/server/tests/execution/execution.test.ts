import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import { EmailJobs } from "@namera-ai/emails";
import { TestEvmExecution } from "@namera-ai/evm";

import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestEmails, TestServerLayer } from "../layers/index.js";

const metadata = (name: string) => ({ version: 1 as const, name });

layer(TestServerLayer)("execution routes", (it) => {
  it.effect(
    "simulates calls and policy eligibility without consuming limits or billing usage",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail("execution-simulation@example.com"));
        const wallet = yield* client.wallet.create({
          payload: {
            namespace: "eip155",
            implementation: "kernel",
            protectionLevel: "software",
            metadata: metadata("Simulation treasury"),
          },
        });
        const sessionKey = yield* client.sessionKey.create({
          payload: {
            namespace: "eip155",
            walletId: wallet.id,
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
              chainId: "eip155:1",
              calls: [{ to: wallet.address, value, data: "0x" }],
            },
          });

        const allowed = yield* simulate(1n);
        expect(allowed).toMatchObject({
          namespace: "eip155",
          walletId: wallet.id,
          chainId: "eip155:1",
          account: wallet.address,
          callsSucceeded: true,
          allowed: true,
          sessionKeyId: sessionKey.id,
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
        ).toBe(0n);
      }),
  );

  it.effect(
    "authenticates an API key, settles policy state, and returns an idempotent receipt",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail("execution-owner@example.com"));
        const wallet = yield* client.wallet.create({
          payload: {
            namespace: "eip155",
            implementation: "kernel",
            protectionLevel: "software",
            metadata: metadata("Treasury"),
          },
        });
        const sessionKey = yield* client.sessionKey.create({
          payload: {
            namespace: "eip155",
            walletId: wallet.id,
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
        const result = yield* client.execution.execute(request);
        expect(result.status).toBe("confirmed");
        if (result.status !== "confirmed") return yield* Effect.die("Expected a receipt");
        expect(result.receipt.success).toBe(true);
        const replay = yield* client.execution.execute(request);
        if (replay.status !== "confirmed") return yield* Effect.die("Expected a receipt");
        expect(replay.executionId).toBe(result.executionId);
        const explicitSponsoredReplay = yield* client.execution.execute({
          ...request,
          payload: { ...request.payload, sponsor: true },
        });
        if (explicitSponsoredReplay.status !== "confirmed") {
          return yield* Effect.die("Expected a receipt");
        }
        expect(explicitSponsoredReplay.executionId).toBe(result.executionId);

        const unsponsored = yield* client.execution.execute({
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
        const billing = yield* client.billing.get();
        expect(billing.meters.find(({ key }) => key === "execution.mainnet")?.consumedAmount).toBe(
          2n,
        );
        expect(billing.meters.find(({ key }) => key === "gas-sponsorship")?.consumedAmount).toBe(
          32_400n,
        );
        expect(
          (yield* repository.audit.organization.findForOrganization(
            owner.actor.organization.id,
          )).some(({ event }) => event === "execution.confirmed"),
        ).toBe(true);

        const emailJobs = yield* EmailJobs;
        const emails = yield* TestEmails;
        let delivered = (yield* emails.sent).findLast(
          (email) => email.type === "execution-confirmed",
        );
        for (let attempt = 0; delivered === undefined && attempt < 10; attempt += 1) {
          yield* emailJobs.processOnce;
          delivered = (yield* emails.sent).findLast(
            (email) => email.type === "execution-confirmed",
          );
        }
        expect(delivered?.variables).toMatchObject({
          chainId: "eip155:1",
          chainIcon: "ethereum",
          chainName: "Ethereum",
          transactionUrl: `https://etherscan.io/tx/${result.receipt.transactionHash}`,
        });
      }),
  );

  it.effect("rejects missing grants, denied policies, and conflicting idempotency requests", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("execution-denied@example.com"));
      const wallet = yield* client.wallet.create({
        payload: {
          namespace: "eip155",
          implementation: "kernel",
          protectionLevel: "software",
          metadata: metadata("Restricted"),
        },
      });
      const sessionKey = yield* client.sessionKey.create({
        payload: {
          namespace: "eip155",
          walletId: wallet.id,
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
        client.execution.execute({
          headers: { "idempotency-key": idempotencyKey },
          payload: {
            namespace: "eip155",
            walletId: wallet.id,
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

  it.effect("settles a submitted execution after the HTTP receipt wait times out", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const testExecution = yield* TestEvmExecution;
      yield* testExecution.setReceiptMode("pending");
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("execution-worker@example.com"));
      const wallet = yield* client.wallet.create({
        payload: {
          namespace: "eip155",
          implementation: "kernel",
          protectionLevel: "software",
          metadata: metadata("Worker treasury"),
        },
      });
      const sessionKey = yield* client.sessionKey.create({
        payload: {
          namespace: "eip155",
          walletId: wallet.id,
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
      const apiKey = yield* client.apiKey.create({
        payload: {
          metadata: metadata("Worker agent"),
          durationDays: 7,
          sessionKeyIds: [sessionKey.id],
        },
      });
      yield* setAuthToken();
      yield* setApiKey(apiKey.key);
      const submitted = yield* client.execution.execute({
        headers: { "idempotency-key": "worker-execution" },
        payload: {
          namespace: "eip155",
          walletId: wallet.id,
          chainId: "eip155:1",
          calls: [{ to: wallet.address, value: 4n, data: "0x" }],
        },
      });
      expect(submitted.status).toBe("submitted");
      const second = yield* client.execution.execute({
        headers: { "idempotency-key": "worker-execution-2" },
        payload: {
          namespace: "eip155",
          walletId: wallet.id,
          chainId: "eip155:1",
          calls: [{ to: wallet.address, value: 0n, data: "0x" }],
        },
      });
      expect(second.status).toBe("submitted");

      yield* TestClock.adjust(Duration.seconds(46));
      const app = yield* Application;
      expect(yield* app.execution.reconcile()).toBe(2);

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
      const wallet = yield* client.wallet.create({
        payload: {
          namespace: "eip155",
          implementation: "kernel",
          protectionLevel: "software",
          metadata: metadata("Failed worker treasury"),
        },
      });
      const sessionKey = yield* client.sessionKey.create({
        payload: {
          namespace: "eip155",
          walletId: wallet.id,
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
      const apiKey = yield* client.apiKey.create({
        payload: {
          metadata: metadata("Failed worker agent"),
          durationDays: 7,
          sessionKeyIds: [sessionKey.id],
        },
      });
      yield* setAuthToken();
      yield* setApiKey(apiKey.key);
      const submitted = yield* client.execution.execute({
        headers: { "idempotency-key": "worker-failed-execution" },
        payload: {
          namespace: "eip155",
          walletId: wallet.id,
          chainId: "eip155:1",
          calls: [{ to: wallet.address, value: 4n, data: "0x" }],
        },
      });
      yield* TestClock.adjust(Duration.seconds(46));
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
      const period = yield* repository.billing.period.findOpen(owner.actor.organization.id);
      if (period === undefined) return yield* Effect.die("Expected billing period");
      expect(
        yield* repository.billing.meterBalance.find(
          owner.actor.organization.id,
          period.id,
          "execution.mainnet",
        ),
      ).toMatchObject({ consumedAmount: 0n, reservedAmount: 0n });
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
