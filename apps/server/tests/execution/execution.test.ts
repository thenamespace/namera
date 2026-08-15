import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect } from "effect";

import { Repository } from "@namera-ai/database";

import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

const metadata = (name: string) => ({ version: 1 as const, name });

layer(TestServerLayer)("execution routes", (it) => {
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
                limits: [{ chainId: "eip155:1", maxAmount: 10n }],
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
        expect((yield* client.billing.get()).usage.executions).toBe(1);
        expect(
          (yield* repository.audit.organization.findForOrganization(
            owner.actor.organization.id,
          )).some(({ event }) => event === "execution.confirmed"),
        ).toBe(true);
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
              limits: [{ chainId: "eip155:1", maxAmount: 1n }],
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
});
