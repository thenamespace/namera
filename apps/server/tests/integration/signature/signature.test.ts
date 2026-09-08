import { expect, layer } from "@effect/vitest";
import { Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import { createTestEvmSessionSigner, makeTestEvmSessionSignatureService } from "@namera-ai/evm";
import { EthereumAddress } from "@namera-ai/protocol";
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
const delayedFixture = makeOwnerSessionTestFixture(
  {},
  { sessionSignatures: makeTestEvmSessionSignatureService({ verificationDelay: "10 minutes" }) },
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
  sessionFixture: typeof fixture = fixture,
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
  const session = yield* sessionFixture.confirmOperation(client, pending, "install");
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

layer(delayedFixture.layer)("signature verification across expiry", (it) => {
  it.effect("does not settle a recovered hold when provider verification returns late", () =>
    Effect.gen(function* () {
      const { client, signer, payload, owner } = yield* setup(undefined, true, delayedFixture);
      const prepared = yield* client.signature.prepare({
        headers: { "idempotency-key": "slow-verification" },
        payload,
      });
      const signature = yield* Effect.promise(() => signer.sign(prepared.signing.typedData));
      const completion = yield* client.signature
        .complete({
          payload: { namespace: "eip155", operationId: prepared.operationId, signature },
        })
        .pipe(Effect.flip, Effect.forkChild);

      // TestClock waits for the completion fiber to suspend in provider work.
      yield* TestClock.adjust(Duration.minutes(6));
      expect(yield* Effect.sync(() => completion.pollUnsafe())).toBeUndefined();
      const application = yield* Application;
      expect(yield* application.billing.reconcile()).toMatchObject({ recovered: 1 });
      yield* TestClock.adjust(Duration.minutes(4));
      expect(yield* Fiber.join(completion)).toMatchObject({ code: "SIGNATURE_UNAVAILABLE" });
      expect(yield* application.billing.reconcile()).toMatchObject({ recovered: 0 });
      yield* setApiKey();
      yield* setAuthToken(owner.cookie.value);
      expect(
        (yield* client.billing.get()).meters.find(({ key }) => key === "signature"),
      ).toMatchObject({ consumedAmount: 0n, reservedAmount: 0n });
    }),
  );
});

layer(fixture.layer)("detached signature routes", (it) => {
  it.effect("enforces persisted typed-data rules before reserving quota", () =>
    Effect.gen(function* () {
      const contract = EthereumAddress.make("0x1111111111111111111111111111111111111111");
      const { client, payload, owner, signer, session, apiKey } = yield* setup([
        {
          type: "evm.signature",
          version: 1,
          allowedTypes: ["typed-data"],
          typedDataRules: [
            {
              chainId: "eip155:1",
              verifyingContract: contract,
              name: "Namera",
              version: "1",
              primaryTypes: ["Authorization"],
            },
          ],
        },
      ]);
      const policyId = session.policies.find(({ type }) => type === "evm.signature")?.id;
      expect(policyId).toBeDefined();
      const headers = { "idempotency-key": "restricted-typed-data" };
      expect(
        yield* client.signature
          .prepare({
            headers,
            payload: { ...payload, type: "typed-data", typedData },
          })
          .pipe(Effect.flip),
      ).toMatchObject({
        code: "POLICY_DENIED",
        policyCode: "TYPED_DATA_NOT_ALLOWED",
        policyId,
      });
      yield* setApiKey();
      yield* setAuthToken(owner.cookie.value);
      expect(
        (yield* client.billing.get()).meters.find(({ key }) => key === "signature"),
      ).toMatchObject({ consumedAmount: 0n, reservedAmount: 0n });
      const repository = yield* Repository;
      const events = yield* repository.audit.organization.findForOrganization(
        owner.actor.organization.id,
      );
      expect(events.filter(({ event }) => event.startsWith("signature."))).toHaveLength(0);

      // A denied attempt does not consume the idempotency key or reserve quota.
      yield* setAuthToken();
      yield* setApiKey(apiKey.key);
      const prepared = yield* client.signature.prepare({
        headers,
        payload: {
          ...payload,
          type: "typed-data",
          typedData: { ...typedData, domain: { ...typedData.domain, verifyingContract: contract } },
        },
      });
      expect(
        yield* client.signature.complete({
          payload: {
            namespace: "eip155",
            operationId: prepared.operationId,
            signature: yield* Effect.promise(() => signer.sign(prepared.signing.typedData)),
          },
        }),
      ).toMatchObject({ type: "typed-data" });
      yield* setApiKey();
      yield* setAuthToken(owner.cookie.value);
      expect(
        (yield* client.billing.get()).meters.find(({ key }) => key === "signature"),
      ).toMatchObject({ consumedAmount: 1n, reservedAmount: 0n });
    }),
  );

  it.effect("concurrent valid completions settle and audit only once", () =>
    Effect.gen(function* () {
      const { client, signer, payload, owner } = yield* setup();
      const prepared = yield* client.signature.prepare({
        headers: { "idempotency-key": "concurrent-success" },
        payload,
      });
      const signature = yield* Effect.promise(() => signer.sign(prepared.signing.typedData));
      const results = yield* Effect.forEach(
        Array.from({ length: 8 }),
        () =>
          client.signature.complete({
            payload: { namespace: "eip155", operationId: prepared.operationId, signature },
          }),
        { concurrency: "unbounded" },
      );
      expect(results).toHaveLength(8);
      for (const result of results) {
        expect(result).toEqual(results[0]);
        expect(result).toMatchObject({ type: "message", signature: "0x1234" });
      }
      const repository = yield* Repository;
      const holds = yield* repository.billing.usageReservation.listBySource(
        owner.actor.organization.id,
        "signature-operation",
        prepared.operationId,
      );
      expect(holds).toHaveLength(1);
      expect(holds[0]).toMatchObject({ status: "settled" });
      const events = yield* repository.audit.organization.findForOrganization(
        owner.actor.organization.id,
      );
      expect(events.filter(({ event }) => event === "signature.created")).toHaveLength(1);
      yield* setApiKey();
      yield* setAuthToken(owner.cookie.value);
      expect(
        (yield* client.billing.get()).meters.find(({ key }) => key === "signature"),
      ).toMatchObject({ consumedAmount: 1n, reservedAmount: 0n });
    }),
  );

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

  it.effect("concurrent expiry recovery releases quota once and rejects late signatures", () =>
    Effect.gen(function* () {
      const { client, payload, signer, owner, apiKey } = yield* setup();
      const prepared = yield* client.signature.prepare({
        headers: { "idempotency-key": "expiry" },
        payload,
      });
      const signature = yield* Effect.promise(() => signer.sign(prepared.signing.typedData));
      yield* TestClock.adjust(Duration.minutes(6));
      const application = yield* Application;
      const attempts = Array.from({ length: 8 });
      const raced = yield* Effect.all(
        {
          completions: Effect.forEach(
            attempts,
            () =>
              client.signature
                .complete({
                  payload: { namespace: "eip155", operationId: prepared.operationId, signature },
                })
                .pipe(Effect.flip),
            { concurrency: "unbounded" },
          ),
          recoveries: Effect.forEach(attempts, () => application.billing.reconcile(), {
            concurrency: "unbounded",
          }),
        },
        { concurrency: "unbounded" },
      );
      for (const failure of raced.completions)
        expect(failure).toMatchObject({ code: "SIGNATURE_UNAVAILABLE" });
      expect(raced.recoveries.reduce((total, result) => total + result.recovered, 0)).toBe(1);
      expect(yield* application.billing.reconcile()).toMatchObject({ recovered: 0 });
      const holds = yield* (yield* Repository).billing.usageReservation.listBySource(
        owner.actor.organization.id,
        "signature-operation",
        prepared.operationId,
      );
      expect(holds).toHaveLength(1);
      expect(holds[0]).toMatchObject({ status: "expired" });
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
