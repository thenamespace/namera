import { expect, layer } from "@effect/vitest";
import { DateTime, Effect } from "effect";
import { TestClock } from "effect/testing";

import { Application, freeBillingPlan } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import {
  createTestEvmSessionSigner,
  makeTestEvmExecutionService,
  makeTestEvmSessionSignatureService,
} from "@namera-ai/evm";
import { Hex } from "@namera-ai/protocol";

import {
  createSession,
  makeTestApiClient,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { localSignatureChallenge } from "../../fixtures/local-signature-challenge.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const provider = makeTestEvmExecutionService();
const fixture = makeOwnerSessionTestFixture(
  {
    sessionSigningMessage: () => Effect.succeed(Hex.make(`0x${"22".repeat(32)}`)),
    completeSessionExecution: provider.sign,
  },
  { sessionSignatures: makeTestEvmSessionSignatureService() },
);

layer(fixture.layer)("operation billing across anniversaries", (it) => {
  it.effect("settles and expires old operations without consuming the new period", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("operation-rollover@example.com"));
      const organizationId = owner.actor.organization.id;
      const repository = yield* Repository;
      const app = yield* Application;
      const initial = yield* repository.billing.period.findOpen(organizationId);
      if (!initial) return yield* Effect.die("Missing initial period");
      // Create operations just before the anniversary, with fresh browser credentials.
      yield* TestClock.adjust(
        DateTime.toEpochMillis(initial.endsAt) -
          DateTime.toEpochMillis(yield* DateTime.now) -
          60_000,
      );
      yield* setAuthToken((yield* createSession(owner.actor)).token);
      const wallet = yield* createTestPasskeyWallet(client);
      const signer = createTestEvmSessionSigner();
      const request = yield* localSessionRequest(wallet.id, ["eip155:1", "eip155:11155111"]);
      const session = yield* client.sessionKey.create({
        payload: {
          ...request,
          signer: { ...request.signer, publicKey: signer.publicKey },
          onchain: { ...request.onchain, allowSignatures: true },
          policies: [{ type: "evm.signature", version: 1, allowedTypes: ["message"] }],
        },
      });
      yield* fixture.confirmOperation(client, session, "install");
      const baseline = yield* repository.billing.meterBalance.listForPeriod(
        organizationId,
        initial.id,
      );
      const key = yield* client.apiKey.create({
        payload: {
          metadata: { version: 1, name: "Rollover agent" },
          durationDays: 7,
          sessionKeyIds: [session.id],
        },
      });
      yield* setAuthToken();
      yield* setApiKey(key.key);
      const executions = yield* Effect.forEach(
        ["eip155:1", "eip155:11155111"] as const,
        (chainId) =>
          Effect.gen(function* () {
            const payload = {
              namespace: "eip155" as const,
              walletId: wallet.id,
              sessionKeyId: session.id,
              chainId,
              calls: [{ to: wallet.address, value: 0n, data: Hex.make("0x") }],
            };
            const complete = yield* client.execution.prepare({
              headers: { "idempotency-key": `complete-${chainId}` },
              payload,
            });
            const abandon = yield* client.execution.prepare({
              headers: { "idempotency-key": `abandon-${chainId}` },
              payload,
            });
            return { complete, abandon };
          }),
      );
      const signaturePayload = {
        namespace: "eip155" as const,
        walletId: wallet.id,
        sessionKeyId: session.id,
        chainId: "eip155:1" as const,
        type: "message" as const,
        message: "Anniversary signature",
      };
      const signature = yield* client.signature.prepare({
        headers: { "idempotency-key": "complete-signature" },
        payload: signaturePayload,
      });
      const abandonedSignature = yield* client.signature.prepare({
        headers: { "idempotency-key": "abandon-signature" },
        payload: signaturePayload,
      });
      yield* TestClock.adjust("90 seconds");
      expect(yield* app.billing.reconcile()).toMatchObject({
        rolledOver: 1,
        recovered: 0,
        repaired: 0,
      });
      const current = yield* repository.billing.period.findOpen(organizationId);
      if (!current) return yield* Effect.die("Missing new period");
      expect(current.id).not.toBe(initial.id);
      for (const { complete } of executions) {
        yield* client.execution.complete({
          payload: {
            namespace: "eip155",
            submissionId: complete.submissionId,
            signature: Hex.make(`0x${"11".repeat(64)}1b`),
          },
        });
      }
      const signed = yield* Effect.promise(() => signer.sign(localSignatureChallenge(signature)));
      yield* client.signature.complete({
        payload: { namespace: "eip155", operationId: signature.operationId, signature: signed },
      });
      yield* TestClock.adjust("2 seconds");
      yield* app.execution.reconcile();
      yield* TestClock.adjust("16 seconds");
      yield* app.execution.reconcile();
      for (const { complete } of executions) {
        expect(
          yield* client.execution.getSubmission({
            params: { submissionId: complete.submissionId },
          }),
        ).toMatchObject({ status: "confirmed" });
      }
      yield* TestClock.adjust("6 minutes");
      yield* app.execution.reconcile();
      expect(yield* app.billing.reconcile()).toMatchObject({ recovered: 2, repaired: 0 });
      expect(yield* app.billing.reconcile()).toMatchObject({ recovered: 0, repaired: 0 });
      for (const { abandon } of executions) {
        expect(
          yield* client.execution.getSubmission({ params: { submissionId: abandon.submissionId } }),
        ).toMatchObject({ status: "failed" });
      }
      expect(
        yield* repository.core.signatureOperation.findByIdForActor(
          abandonedSignature.operationId,
          organizationId,
          key.apiKey.actorId,
        ),
      ).toMatchObject({ status: "failed" });
      for (const meter of Object.values(freeBillingPlan.meters)) {
        const previous = yield* repository.billing.meterBalance.find(
          organizationId,
          initial.id,
          meter.key,
        );
        const consumed =
          (baseline.find((balance) => balance.meterKey === meter.key)?.consumedAmount ?? 0n) +
          (meter.key === "gas-sponsorship" ? 32_400n : 1n);
        expect(previous).toMatchObject({ consumedAmount: consumed, reservedAmount: 0n });
        expect(
          yield* repository.billing.usageEvent.getNetAmount(organizationId, initial.id, meter.key),
        ).toBe(consumed);
        expect(
          yield* repository.billing.usageReservation.sumActiveForMeter(
            organizationId,
            initial.id,
            meter.key,
          ),
        ).toBe(0n);
        expect(
          yield* repository.billing.meterBalance.find(organizationId, current.id, meter.key),
        ).toMatchObject({ consumedAmount: 0n, reservedAmount: 0n });
        expect(
          yield* repository.billing.usageEvent.getNetAmount(organizationId, current.id, meter.key),
        ).toBe(0n);
      }
      yield* setApiKey();
      yield* setAuthToken((yield* createSession(owner.actor)).token);
      const billing = yield* client.billing.get();
      for (const meter of billing.meters) {
        expect(meter).toMatchObject({
          consumedAmount: 0n,
          reservedAmount: 0n,
          remainingAmount: freeBillingPlan.meters[meter.key].includedAmount,
        });
      }
    }),
  );
});
