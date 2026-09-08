import { expect, layer } from "@effect/vitest";
import { Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import { createTestEvmSessionSigner, makeTestEvmSessionSignatureService } from "@namera-ai/evm";
import type { CreateSessionKeyRequest } from "@namera-ai/protocol/dto";

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

const fixture = makeOwnerSessionTestFixture(
  {},
  { sessionSignatures: makeTestEvmSessionSignatureService() },
);
const typedData = {
  domain: { name: "Namera", version: "1", chainId: 1 },
  types: { Authorization: [{ name: "action", type: "string" }] },
  primaryType: "Authorization",
  message: { action: "test" },
};
const setup = Effect.fn("test.signature.setup")(function* (
  policies: CreateSessionKeyRequest["policies"] = [
    { type: "evm.signature", version: 1, allowedTypes: ["message", "typed-data"] },
  ],
  allowSignatures = true,
) {
  yield* resetTestState();
  const client = yield* makeTestApiClient;
  const owner = yield* signIn(client, testEmail(`signature-${crypto.randomUUID()}@example.com`));
  const wallet = yield* createTestPasskeyWallet(client, "Signing account");
  const signer = createTestEvmSessionSigner();
  const request = yield* localSessionRequest(wallet.id);
  const pending = yield* client.sessionKey.create({
    payload: {
      ...request,
      signer: { ...request.signer, publicKey: signer.publicKey },
      onchain: { ...request.onchain, allowSignatures },
      policies,
    },
  });
  const session = yield* fixture.confirmOperation(client, pending, "install");
  const apiKey = yield* client.apiKey.create({
    payload: {
      metadata: { version: 1, name: "Signing agent" },
      durationDays: 7,
      sessionKeyIds: [session.id],
    },
  });
  yield* setAuthToken();
  yield* setApiKey(apiKey.key);
  const payload = {
    namespace: "eip155",
    walletId: wallet.id,
    sessionKeyId: session.id,
    chainId: "eip155:1",
    type: "message",
    message: "Authorize this action",
  } as const;
  return { client, owner, wallet, signer, session, apiKey, payload };
});

layer(fixture.layer)("detached signature routes", (it) => {
  it.effect(
    "meters message/typed-data completion exactly once and keeps signatures out of storage",
    () =>
      Effect.gen(function* () {
        const { client, signer, payload, owner, apiKey } = yield* setup();
        const headers = { "idempotency-key": "message" };
        const prepared = yield* client.signature.prepare({ headers, payload });
        expect(yield* client.signature.prepare({ headers, payload })).toEqual(prepared);
        expect(
          yield* client.signature
            .prepare({ headers, payload: { ...payload, message: "different" } })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
        const signature = yield* Effect.promise(() => signer.sign(prepared.signing.typedData));
        const complete = {
          namespace: "eip155" as const,
          operationId: prepared.operationId,
          signature,
        };
        const result = yield* client.signature.complete({ payload: complete });
        expect(result).toMatchObject({ type: "message", signature: "0x1234" });
        expect(yield* client.signature.complete({ payload: complete })).toEqual(result);
        const typed = yield* client.signature.prepare({
          headers: { "idempotency-key": "typed" },
          payload: { ...payload, type: "typed-data", typedData },
        });
        expect(
          yield* client.signature.complete({
            payload: {
              namespace: "eip155",
              operationId: typed.operationId,
              signature: yield* Effect.promise(() => signer.sign(typed.signing.typedData)),
            },
          }),
        ).toMatchObject({ type: "typed-data", signature: "0x1234" });
        expect(
          yield* client.signature
            .sign({ headers: { "idempotency-key": "legacy" }, payload })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "SIGNATURE_UNAVAILABLE" });
        const repository = yield* Repository;
        const operation = yield* repository.core.signatureOperation.findByIdForActor(
          prepared.operationId,
          owner.actor.organization.id,
          apiKey.apiKey.actorId,
        );
        expect(operation).toMatchObject({
          status: "succeeded",
          data: { type: "message", message: payload.message, payloadSizeBytes: 21 },
        });
        expect(JSON.stringify(operation)).not.toContain(signature);
        yield* setApiKey();
        yield* setAuthToken(owner.cookie.value);
        const usage = (yield* client.billing.get()).meters.find(({ key }) => key === "signature");
        expect(usage).toMatchObject({ consumedAmount: 2n, reservedAmount: 0n });
        const events = yield* repository.audit.organization.findForOrganization(
          owner.actor.organization.id,
        );
        expect(events.filter(({ event }) => event === "signature.created")).toHaveLength(2);
        expect(events.filter(({ event }) => event === "signature.prepared")).toHaveLength(2);
      }),
  );

  it.effect(
    "rejects a wrong signer without consuming the attempt, then permits a valid retry",
    () =>
      Effect.gen(function* () {
        const { client, payload, signer } = yield* setup();
        const prepared = yield* client.signature.prepare({
          headers: { "idempotency-key": "retry" },
          payload,
        });
        const wrong = createTestEvmSessionSigner();
        expect(
          yield* client.signature
            .complete({
              payload: {
                namespace: "eip155",
                operationId: prepared.operationId,
                signature: yield* Effect.promise(() => wrong.sign(prepared.signing.typedData)),
              },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "SIGNING_FAILED" });
        expect(
          yield* client.signature.complete({
            payload: {
              namespace: "eip155",
              operationId: prepared.operationId,
              signature: yield* Effect.promise(() => signer.sign(prepared.signing.typedData)),
            },
          }),
        ).toMatchObject({ signature: "0x1234" });
      }),
  );

  it.effect("expires unsigned attempts and recovers quota without accepting late signatures", () =>
    Effect.gen(function* () {
      const { client, payload, signer, owner, apiKey } = yield* setup();
      const prepared = yield* client.signature.prepare({
        headers: { "idempotency-key": "expiry" },
        payload,
      });
      const signature = yield* Effect.promise(() => signer.sign(prepared.signing.typedData));
      yield* TestClock.adjust(Duration.minutes(6));
      expect(
        yield* client.signature
          .complete({
            payload: { namespace: "eip155", operationId: prepared.operationId, signature },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "SIGNATURE_UNAVAILABLE" });
      yield* (yield* Application).billing.reconcile();
      expect(
        yield* (yield* Repository).core.signatureOperation.findByIdForActor(
          prepared.operationId,
          owner.actor.organization.id,
          apiKey.apiKey.actorId,
        ),
      ).toMatchObject({ status: "failed", failureCode: "PREPARATION_EXPIRED" });
      yield* setApiKey();
      yield* setAuthToken(owner.cookie.value);
      expect(
        (yield* client.billing.get()).meters.find(({ key }) => key === "signature"),
      ).toMatchObject({ consumedAmount: 0n, reservedAmount: 0n });
    }),
  );

  it.effect("checks API signature policy independently of onchain signature permission", () =>
    Effect.gen(function* () {
      const { client, payload } = yield* setup([
        { type: "evm.signature", version: 1, allowedTypes: ["message"] },
      ]);
      expect(
        yield* client.signature
          .prepare({
            headers: { "idempotency-key": "denied" },
            payload: { ...payload, type: "typed-data", typedData },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "POLICY_DENIED", policyCode: "SIGNATURE_TYPE_NOT_ALLOWED" });
    }),
  );

  it.effect("verifies with no signature authority, but cannot prepare a signature", () =>
    Effect.gen(function* () {
      const { client, payload } = yield* setup([], false);
      expect(
        yield* client.signature.verify({ payload: { ...payload, signature: "0x1234" } }),
      ).toMatchObject({ valid: true });
      expect(
        yield* client.signature.verify({ payload: { ...payload, signature: "0xabcd" } }),
      ).toMatchObject({ valid: false });
      expect(
        yield* client.signature.verify({
          payload: { ...payload, type: "typed-data", typedData, signature: "0x1234" },
        }),
      ).toMatchObject({ valid: true });
      expect(
        yield* client.signature
          .prepare({ headers: { "idempotency-key": "no-onchain-authority" }, payload })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "SIGNATURE_UNAVAILABLE" });
    }),
  );

  it.effect("rejects another actor's operation and rechecks revocation before completion", () =>
    Effect.gen(function* () {
      const { client, payload, signer, owner, session, apiKey } = yield* setup();
      const prepared = yield* client.signature.prepare({
        headers: { "idempotency-key": "scope" },
        payload,
      });
      const complete = {
        namespace: "eip155" as const,
        operationId: prepared.operationId,
        signature: yield* Effect.promise(() => signer.sign(prepared.signing.typedData)),
      };
      yield* setApiKey();
      yield* setAuthToken(owner.cookie.value);
      const other = yield* client.apiKey.create({
        payload: {
          metadata: { version: 1, name: "Other actor" },
          durationDays: 7,
          sessionKeyIds: [session.id],
        },
      });
      yield* setAuthToken();
      yield* setApiKey(other.key);
      expect(
        yield* client.signature.complete({ payload: complete }).pipe(Effect.flip),
      ).toMatchObject({ code: "SIGNATURE_UNAVAILABLE" });
      yield* setApiKey();
      yield* setAuthToken(owner.cookie.value);
      yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
      yield* setAuthToken();
      yield* setApiKey(apiKey.key);
      expect(
        yield* client.signature.complete({ payload: complete }).pipe(Effect.flip),
      ).toMatchObject({ code: "NO_AUTHORIZED_SESSION_KEY" });
    }),
  );
});
