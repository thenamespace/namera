import { expect, layer } from "@effect/vitest";
import { Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { Database } from "@namera-ai/database";
import { EthereumAddress, Hex } from "@namera-ai/protocol";

import { handledApi } from "../../fixtures/http-api-test.js";
import {
  createMember,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  setApiKey,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture();
const request = {
  namespace: "eip155" as const,
  chainId: "eip155:8453" as const,
  sponsor: false,
  calls: [
    {
      to: EthereumAddress.make("0x4444444444444444444444444444444444444444"),
      value: 123n,
      data: Hex.make("0x"),
    },
    {
      to: EthereumAddress.make("0x5555555555555555555555555555555555555555"),
      value: 0n,
      data: Hex.make("0xabcd"),
    },
  ],
};
const setup = Effect.gen(function* () {
  yield* resetTestState();
  const author = yield* signIn(
    yield* makeTestApiClient,
    testEmail("owner-transaction@example.com"),
  );
  const client = yield* handledApi(NameraApi, {
    headers: { cookie: `auth-token=${author.cookie.value}`, origin: "http://dashboard.test" },
  });
  const wallet = yield* createTestPasskeyWallet(client);
  return { client, author, wallet, params: { walletId: wallet.id } };
});

layer(fixture.layer)("owner wallet transactions", (it) => {
  it.effect("executes a non-ENS batch on the requested chain and exposes durable status", () =>
    Effect.gen(function* () {
      const { client, params, wallet } = yield* setup;
      const input = { params, headers: { "idempotency-key": "batch" }, payload: request };
      const prepared = yield* client.walletTransaction.prepare(input);
      expect(prepared.signingKeyId).toBe(wallet.owner.signingKeyId);
      expect(prepared.prepared.chainId).toBe(request.chainId);
      expect(prepared.prepared.context.calls).toEqual(request.calls);
      expect((yield* client.walletTransaction.prepare(input)).operationId).toBe(
        prepared.operationId,
      );
      expect(
        yield* client.walletTransaction
          .prepare({
            ...input,
            payload: { ...request, sponsor: true },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      const operationParams = { ...params, operationId: prepared.operationId };
      expect(yield* client.walletTransaction.get({ params: operationParams })).toMatchObject({
        status: "awaiting-signature",
        userOperationHash: null,
        transactionHash: null,
      });
      if (prepared.signing.method !== "passkey") return yield* Effect.die("Expected passkey");
      const payload = {
        namespace: "eip155" as const,
        operationId: prepared.operationId,
        response: fixture.authenticator.authenticate({
          challenge: prepared.signing.options.challenge,
          origin: "http://dashboard.test",
          rpId: "dashboard.test",
          counter: 0,
        }),
      };
      const signed = yield* client.walletTransaction.complete({ params, payload });
      expect(signed.status).toBe("signed");
      expect(yield* client.walletTransaction.complete({ params, payload })).toEqual(signed);
      yield* TestClock.adjust(Duration.seconds(2));
      yield* (yield* Application).wallet.transactions.reconcile();
      expect(yield* client.walletTransaction.get({ params: operationParams })).toMatchObject({
        status: "confirmed",
        userOperationHash: signed.userOperationHash,
      });
      const db = yield* Database;
      const operations = yield* db.query.walletOperation.findMany();
      expect(operations).toHaveLength(1);
      expect(operations[0]?.kind).toBe("transaction");
      expect(operations[0]?.data.name).toBeUndefined();
    }),
  );

  it.effect("rejects wrong origin and another tenant for prepare, completion and reads", () =>
    Effect.gen(function* () {
      const { client, author, params } = yield* setup;
      const input = { params, headers: { "idempotency-key": "scope" }, payload: request };
      const wrongOrigin = yield* handledApi(NameraApi, {
        headers: { cookie: `auth-token=${author.cookie.value}`, origin: "https://evil.test" },
      });
      expect(yield* wrongOrigin.walletTransaction.prepare(input).pipe(Effect.flip)).toMatchObject({
        _tag: "Forbidden",
      });
      const prepared = yield* client.walletTransaction.prepare(input);
      const completion = {
        params,
        payload: { namespace: "eip155" as const, operationId: prepared.operationId },
      };
      expect(
        yield* wrongOrigin.walletTransaction.complete(completion).pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
      const other = yield* signIn(
        yield* makeTestApiClient,
        testEmail("other-transaction@example.com"),
      );
      const foreign = yield* handledApi(NameraApi, {
        headers: { cookie: `auth-token=${other.cookie.value}`, origin: "http://dashboard.test" },
      });
      expect(yield* foreign.walletTransaction.prepare(input).pipe(Effect.flip)).toMatchObject({
        code: "OWNER_UNAVAILABLE",
      });
      expect(yield* foreign.walletTransaction.complete(completion).pipe(Effect.flip)).toMatchObject(
        { code: "OPERATION_UNAVAILABLE" },
      );
      expect(
        yield* foreign.walletTransaction
          .get({
            params: { ...params, operationId: prepared.operationId },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "OWNER_UNAVAILABLE" });
      expect((yield* (yield* Database).query.walletOperation.findMany())[0]?.status).toBe(
        "awaiting-signature",
      );
    }),
  );

  it.effect(
    "binds approval to the initiating user and rejects members without owner permission",
    () =>
      Effect.gen(function* () {
        const { client, author, params } = yield* setup;
        const prepared = yield* client.walletTransaction.prepare({
          params,
          headers: { "idempotency-key": "initiator" },
          payload: request,
        });
        if (prepared.signing.method !== "passkey") return yield* Effect.die("Expected passkey");
        const completion = {
          params,
          payload: {
            namespace: "eip155" as const,
            operationId: prepared.operationId,
            response: fixture.authenticator.authenticate({
              challenge: prepared.signing.options.challenge,
              origin: "http://dashboard.test",
              rpId: "dashboard.test",
              counter: 1,
            }),
          },
        };
        for (const role of ["admin", "member"] as const) {
          yield* setAuthToken(author.cookie.value);
          const member = yield* createMember(
            yield* makeTestApiClient,
            testEmail(`transaction-${role}@example.com`),
            role,
          );
          const other = yield* handledApi(NameraApi, {
            headers: {
              cookie: `auth-token=${member.memberToken}`,
              origin: "http://dashboard.test",
            },
          });
          const error = yield* other.walletTransaction.complete(completion).pipe(Effect.flip);
          expect(error).toMatchObject({ _tag: "Forbidden" });
          expect(
            yield* other.walletTransaction
              .prepare({
                params,
                headers: { "idempotency-key": `blocked-${role}` },
                payload: request,
              })
              .pipe(Effect.flip),
          ).toMatchObject({ _tag: "Forbidden" });
          expect(
            yield* other.walletTransaction
              .get({
                params: { ...params, operationId: prepared.operationId },
              })
              .pipe(Effect.flip),
          ).toMatchObject({ _tag: "Forbidden" });
        }
        expect((yield* client.walletTransaction.complete(completion)).status).toBe("signed");
      }),
  );

  it.effect("rejects API keys even with an active wallet grant", () =>
    Effect.gen(function* () {
      const { client, wallet, params } = yield* setup;
      const session = yield* client.sessionKey.create({
        payload: yield* localSessionRequest(wallet.id),
      });
      yield* fixture.confirmOperation(client, session, "install");
      const key = yield* client.apiKey.create({
        payload: {
          metadata: { version: 1, name: "Agent" },
          durationDays: 7,
          sessionKeyIds: [session.id],
        },
      });
      const prepared = yield* client.walletTransaction.prepare({
        params,
        headers: { "idempotency-key": "machine" },
        payload: request,
      });
      yield* setAuthToken();
      yield* setApiKey(key.key);
      const machine = yield* makeTestApiClient;
      expect((yield* machine.wallet.get({ params })).id).toBe(wallet.id);
      expect(
        yield* machine.walletTransaction
          .prepare({
            params,
            headers: { "idempotency-key": "machine-blocked" },
            payload: request,
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
      expect(
        yield* machine.walletTransaction
          .complete({
            params,
            payload: { namespace: "eip155", operationId: prepared.operationId },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
      expect(
        yield* machine.walletTransaction
          .get({
            params: { ...params, operationId: prepared.operationId },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
    }),
  );
});
