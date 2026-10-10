import { expect, layer } from "@effect/vitest";
import { Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import { makeTestEvmExecutionService, TestEvmExecution } from "@namera-ai/evm";
import { EvmExecutionError, Hex } from "@namera-ai/protocol";

import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { registerPendingLocalSession } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const acceptedSignature = Hex.make(`0x${"11".repeat(64)}1b`);
const execution = makeTestEvmExecutionService();
// Real cryptographic verification and validation envelopes are covered by the
// EVM Anvil suite; this boundary verifies orchestration around that adapter.
const fixture = makeOwnerSessionTestFixture({
  prepare: (input) =>
    input.session === undefined
      ? Effect.fail(
          new EvmExecutionError({
            code: "PREPARATION_FAILED",
            cause: "Expected installed session authority",
          }),
        )
      : execution.prepare(input),
  sessionSigningMessage: () => Effect.succeed(Hex.make(`0x${"22".repeat(32)}`)),
  completeSessionExecution: (input) =>
    input.signature === acceptedSignature
      ? execution.sign(input)
      : Effect.fail(
          new EvmExecutionError({ code: "SIGNING_FAILED", cause: "Invalid test signature" }),
        ),
});

layer(fixture.layer)("local execution HTTP flow", (it) => {
  it.effect("reserves an installed session, accepts once, and recovers through the worker", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("local-execution@namera.test"));
      const { wallet, session } = yield* registerPendingLocalSession(client, ["eip155:11155111"]);
      const installation = session.installations[0];
      if (installation === undefined) return yield* Effect.die("Missing installation");
      const approval = yield* client.sessionKey.prepareOperation({
        payload: {
          installationId: installation.id,
          kind: "install",
          idempotencyKey: crypto.randomUUID(),
          sponsor: false,
        },
      });
      yield* client.sessionKey.completeOperation({
        payload: {
          operationId: approval.operationId,
          response: fixture.authenticator.authenticate({
            challenge: approval.options.challenge,
            origin: "http://dashboard.test",
            rpId: "dashboard.test",
            counter: 1,
          }),
        },
      });
      yield* (yield* TestEvmExecution).setReceiptMode("immediate");
      yield* TestClock.adjust(Duration.seconds(2));
      const app = yield* Application;
      yield* app.sessionKey.reconcileOperations();
      const apiKey = yield* client.apiKey.create({
        payload: {
          metadata: { version: 1, name: "Local runner" },
          durationDays: 1,
          sessionKeyIds: [session.id],
        },
      });
      const otherApiKey = yield* client.apiKey.create({
        payload: {
          metadata: { version: 1, name: "Other runner" },
          durationDays: 1,
          sessionKeyIds: [session.id],
        },
      });
      yield* setApiKey(apiKey.key);
      const request = {
        headers: { "idempotency-key": crypto.randomUUID() },
        payload: {
          namespace: "eip155" as const,
          walletId: wallet.id,
          sessionKeyId: session.id,
          chainId: "eip155:11155111" as const,
          calls: [{ to: wallet.address, value: 0n, data: Hex.make("0x") }],
          sponsor: false,
        },
      };
      const simulated = yield* client.execution.simulate({ payload: request.payload });
      expect(simulated).toMatchObject({
        allowed: true,
        callsSucceeded: true,
        sessionKeyId: session.id,
      });
      expect(yield* app.execution.reconcile()).toBe(0);
      const prepared = yield* client.execution.prepare(request);
      expect(prepared.signing.method).toBe("personal_sign");
      expect(
        yield* client.execution
          .complete({ payload: { namespace: "eip155", submissionId: prepared.submissionId } })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "EXECUTION_UNAVAILABLE" });
      expect(
        (yield* client.execution.getSubmission({ params: { submissionId: prepared.submissionId } }))
          .status,
      ).toBe("reserved");
      expect((yield* client.execution.prepare(request)).submissionId).toBe(prepared.submissionId);
      expect(
        yield* client.execution
          .prepare({
            ...request,
            payload: { ...request.payload, sponsor: true },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      yield* setApiKey(otherApiKey.key);
      expect(
        yield* client.execution
          .complete({
            payload: {
              namespace: "eip155",
              submissionId: prepared.submissionId,
              signature: acceptedSignature,
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "EXECUTION_UNAVAILABLE" });
      expect(
        yield* client.execution
          .getSubmission({
            params: { submissionId: prepared.submissionId },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "EXECUTION_SUBMISSION_NOT_FOUND" });
      yield* setApiKey(apiKey.key);
      const repository = yield* Repository;
      const reservations = yield* repository.billing.usageReservation.listBySource(
        owner.actor.organization.id,
        "execution-submission",
        prepared.submissionId,
      );
      expect(reservations).toHaveLength(1);
      expect(reservations[0]?.status).toBe("active");
      expect(
        yield* client.execution
          .complete({
            payload: {
              namespace: "eip155",
              submissionId: prepared.submissionId,
              signature: Hex.make(`0x${"33".repeat(65)}`),
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "EXECUTION_FAILED" });
      expect(
        (yield* repository.core.executionSubmission.findById(
          prepared.submissionId,
          owner.actor.organization.id,
        ))?.status,
      ).toBe("reserved");
      const completed = yield* client.execution.complete({
        payload: {
          namespace: "eip155",
          submissionId: prepared.submissionId,
          signature: acceptedSignature,
        },
      });
      expect(completed.status).toBe("prepared");
      expect(
        (yield* client.execution.getSubmission({ params: { submissionId: prepared.submissionId } }))
          .status,
      ).toBe("prepared");
      expect(
        yield* client.execution.complete({
          payload: {
            namespace: "eip155",
            submissionId: prepared.submissionId,
            signature: acceptedSignature,
          },
        }),
      ).toEqual(completed);
      yield* TestClock.adjust(Duration.seconds(2));
      expect(yield* app.execution.reconcile()).toBe(1);
      yield* TestClock.adjust(Duration.seconds(16));
      expect(yield* app.execution.reconcile()).toBe(1);
      expect(
        (yield* client.execution.getSubmission({ params: { submissionId: prepared.submissionId } }))
          .status,
      ).toBe("confirmed");
      expect(
        (yield* repository.billing.usageReservation.listBySource(
          owner.actor.organization.id,
          "execution-submission",
          prepared.submissionId,
        ))[0]?.status,
      ).toBe("settled");

      const expiring = yield* client.execution.prepare({
        ...request,
        headers: { "idempotency-key": crypto.randomUUID() },
      });
      yield* TestClock.adjust(Duration.minutes(5));
      expect(
        yield* client.execution
          .complete({
            payload: {
              namespace: "eip155",
              submissionId: expiring.submissionId,
              signature: acceptedSignature,
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "EXECUTION_UNAVAILABLE" });
      expect(yield* app.execution.reconcile()).toBe(1);
      expect(
        (yield* repository.billing.usageReservation.listBySource(
          owner.actor.organization.id,
          "execution-submission",
          expiring.submissionId,
        ))[0]?.status,
      ).toBe("released");

      const revoked = yield* client.execution.prepare({
        ...request,
        headers: { "idempotency-key": crypto.randomUUID() },
      });
      yield* setApiKey();
      yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
      yield* setApiKey(apiKey.key);
      expect(
        yield* client.execution.simulate({ payload: request.payload }).pipe(Effect.flip),
      ).toMatchObject({ code: "NO_AUTHORIZED_SESSION_KEY" });
      expect(
        yield* client.execution
          .complete({
            payload: {
              namespace: "eip155",
              submissionId: revoked.submissionId,
              signature: acceptedSignature,
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "NO_AUTHORIZED_SESSION_KEY" });
      expect(
        (yield* repository.core.executionSubmission.findById(
          revoked.submissionId,
          owner.actor.organization.id,
        ))?.data.signedExecution,
      ).toBeNull();
    }),
  );
});
