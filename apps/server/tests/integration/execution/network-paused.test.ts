import { expect, layer } from "@effect/vitest";
import { Context, Effect } from "effect";

import { Repository } from "@namera-ai/database";
import { makeTestEvmExecutionService, makeTestEvmSessionService } from "@namera-ai/evm";
import { EvmExecutionError, Hex } from "@namera-ai/protocol";

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

const paused = Context.Reference<boolean>("test/networkPaused", { defaultValue: () => false });
const admission = Effect.gen(function* () {
  if (yield* paused)
    return yield* new EvmExecutionError({
      code: "NETWORK_PAUSED",
      cause: new Error("Network paused"),
    });
});
const provider = makeTestEvmExecutionService();
const sessions = makeTestEvmSessionService();
const fixture = makeOwnerSessionTestFixture(
  {
    prepare: (input) => admission.pipe(Effect.andThen(provider.prepare(input))),
    sessionSigningMessage: () => admission.pipe(Effect.as(Hex.make(`0x${"22".repeat(32)}`))),
    completeSessionExecution: (input) => admission.pipe(Effect.andThen(provider.sign(input))),
  },
  {
    sessions: {
      ...sessions,
      compile: (input) => admission.pipe(Effect.andThen(sessions.compile(input))),
      prepareOperation: (input) => admission.pipe(Effect.andThen(sessions.prepareOperation(input))),
    },
  },
);

layer(fixture.layer)("paused network HTTP boundary", (it) => {
  it.effect("preserves the pause code without accepting new sessions or execution signatures", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("network-paused@example.com"));
      const wallet = yield* createTestPasskeyWallet(client);
      const request = yield* localSessionRequest(wallet.id);
      const pausedCreation = yield* client.sessionKey
        .create({ payload: request })
        .pipe(Effect.provideService(paused, true), Effect.flip);
      expect(pausedCreation).toMatchObject({
        _tag: "SessionKeyCreationError",
        code: "NETWORK_PAUSED",
      });
      expect(yield* client.sessionKey.listForOrganization()).toHaveLength(0);
      const session = yield* client.sessionKey.create({ payload: request });
      const installation = session.installations[0];
      if (!installation) throw new Error("Missing installation");
      expect(
        yield* client.sessionKey
          .prepareOperation({
            payload: {
              installationId: installation.id,
              kind: "install",
              sponsor: false,
              idempotencyKey: "paused-install",
            },
          })
          .pipe(Effect.provideService(paused, true), Effect.flip),
      ).toMatchObject({
        _tag: "SessionKeyOperationError",
        code: "NETWORK_PAUSED",
      });
      yield* fixture.confirmOperation(client, session, "install");
      const key = yield* client.apiKey.create({
        payload: {
          metadata: { version: 1, name: "Paused agent" },
          durationDays: 7,
          sessionKeyIds: [session.id],
        },
      });
      const before = yield* client.billing.get();
      yield* setAuthToken();
      yield* setApiKey(key.key);
      const operation = {
        headers: { "idempotency-key": "paused-execution" },
        payload: {
          namespace: "eip155" as const,
          walletId: wallet.id,
          sessionKeyId: session.id,
          chainId: "eip155:1" as const,
          calls: [{ to: wallet.address, value: 0n, data: Hex.make("0x") }],
        },
      };
      expect(
        yield* client.execution
          .prepare(operation)
          .pipe(Effect.provideService(paused, true), Effect.flip),
      ).toMatchObject({ _tag: "ExecutionError", code: "NETWORK_PAUSED" });
      yield* setApiKey();
      yield* setAuthToken(owner.cookie.value);
      expect((yield* client.billing.get()).meters).toEqual(before.meters);
      yield* setAuthToken();
      yield* setApiKey(key.key);
      // The failed admission did not consume the idempotency key.
      const prepared = yield* client.execution.prepare(operation);
      expect(
        yield* client.execution
          .complete({
            payload: {
              namespace: "eip155",
              submissionId: prepared.submissionId,
              signature: Hex.make(`0x${"11".repeat(64)}1b`),
            },
          })
          .pipe(Effect.provideService(paused, true), Effect.flip),
      ).toMatchObject({
        _tag: "ExecutionError",
        code: "NETWORK_PAUSED",
      });
      const repository = yield* Repository;
      const stored = yield* repository.core.executionSubmission.findById(
        prepared.submissionId,
        owner.actor.organization.id,
      );
      expect(stored?.status).toBe("reserved");
      expect(stored?.data.signedExecution).toBeNull();
    }),
  );
});
