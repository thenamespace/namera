import { expect, it } from "@effect/vitest";
import { Clock, Effect } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { Database } from "@namera-ai/database";
import {
  createTestEvmSessionSigner,
  makeTestEvmExecutionService,
  makeTestEvmSessionSignatureService,
} from "@namera-ai/evm";
import { Hex } from "@namera-ai/protocol";

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
import { platformIdentity } from "../../fixtures/platform.js";
import { executeFixture } from "../execution/fixture.js";

const execution = makeTestEvmExecutionService();
const fixture = makeOwnerSessionTestFixture(
  {
    sessionSigningMessage: () => Effect.succeed(Hex.make(`0x${"22".repeat(32)}`)),
    completeSessionExecution: execution.sign,
  },
  { sessionSignatures: makeTestEvmSessionSignatureService() },
);

it.effect("counts platform resources and completed operations, not signature reservations", () =>
  Effect.gen(function* () {
    yield* resetTestState();
    yield* TestClock.setTime(yield* TestClock.withLive(Clock.currentTimeMillis));
    const admin = yield* platformIdentity();
    const client = yield* makeTestApiClient;
    yield* signIn(client, testEmail("overview-customer@example.com"));
    const wallet = yield* createTestPasskeyWallet(client);
    const signer = createTestEvmSessionSigner();
    const request = yield* localSessionRequest(wallet.id);
    const pending = yield* client.sessionKey.create({
      payload: {
        ...request,
        signer: { ...request.signer, publicKey: signer.publicKey },
        onchain: { ...request.onchain, allowSignatures: true },
        policies: [{ type: "evm.signature", version: 1, allowedTypes: ["message"] }],
      },
    });
    const sessionKey = yield* fixture.confirmOperation(client, pending, "install");
    const apiKey = yield* client.apiKey.create({
      payload: {
        metadata: { version: 1, name: "Overview agent" },
        durationDays: 7,
        sessionKeyIds: [sessionKey.id],
      },
    });
    yield* setAuthToken();
    yield* setApiKey(apiKey.key);
    expect(
      (yield* executeFixture(client, { wallet, sessionKey }, "overview-execution")).status,
    ).toBe("confirmed");

    const payload = {
      namespace: "eip155",
      walletId: wallet.id,
      sessionKeyId: sessionKey.id,
      chainId: "eip155:1",
      type: "message",
      message: "Overview signature",
    } as const;
    const prepared = yield* client.signature.prepare({
      headers: { "idempotency-key": "overview-success" },
      payload,
    });
    const signature = yield* Effect.promise(() => signer.sign(prepared.signing.typedData));
    yield* client.signature.complete({
      payload: { namespace: "eip155", operationId: prepared.operationId, signature },
    });
    const db = yield* Database;
    // Completion, not preparation, determines the activity bucket.
    yield* db.execute(
      "update core.signature_operation set created_at = now() - interval '120 days' where status = 'succeeded'",
    );
    yield* client.signature.prepare({
      headers: { "idempotency-key": "overview-expired" },
      payload,
    });
    yield* TestClock.adjust("6 minutes");
    yield* (yield* Application).billing.reconcile();
    yield* client.signature.prepare({
      headers: { "idempotency-key": "overview-reserved" },
      payload,
    });
    const overview = yield* admin.client.adminOverview.get({ query: { period: "7d" } });
    expect(overview.totals).toMatchObject({
      users: 2,
      accounts: 1,
      sessionKeys: 1,
      executions: 1,
      signatures: 1,
    });
    expect(overview.periodCounts).toMatchObject({
      accounts: 1,
      sessionKeys: 1,
      executions: 1,
      signatures: 1,
    });
    expect(overview.current.activeSessionKeys).toBe(1);
    expect(overview.activity.reduce((sum, day) => sum + day.signatures, 0)).toBe(1);
  }).pipe(Effect.provide(fixture.layer)),
);
