import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect, Schema } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { Database, walletOperation } from "@namera-ai/database";
import { TestEvmExecution } from "@namera-ai/evm";
import { EthereumAddress, WalletId } from "@namera-ai/protocol";
import { WalletOperation, WalletOperationData } from "@namera-ai/protocol/model";

import { handledApi } from "../../fixtures/http-api-test.js";
import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture(
  {},
  {
    billing: {
      getNativeUsdcQuote: () =>
        Effect.map(DateTime.now, (quotedAt) => ({
          ethUsd: 3000,
          usdcUsd: 0.998,
          quotedAt,
        })),
    },
    identity: {
      status: (_name, address) =>
        Effect.succeed({ primaryName: null, forwardAddress: address, verified: false }),
      call: () =>
        Effect.succeed({
          to: EthereumAddress.make("0x4444444444444444444444444444444444444444"),
          value: 0n,
          data: "0x1234",
        }),
    },
  },
);
const setup = Effect.gen(function* () {
  yield* resetTestState();
  const author = yield* signIn(yield* makeTestApiClient, testEmail("primary@example.com"));
  const client = yield* handledApi(NameraApi, {
    headers: { cookie: `auth-token=${author.cookie.value}`, origin: "http://dashboard.test" },
  });
  const wallet = yield* createTestPasskeyWallet(client);
  const params = { walletId: wallet.id, label: "treasury" };
  yield* client.identity.create({ params, payload: { label: params.label } });
  return { client, params, wallet };
});

layer(fixture.layer)("Ethereum primary identity", (it) => {
  it.effect(
    "rejects a substituted stored call and excludes concurrent session-key owner operations",
    () =>
      Effect.gen(function* () {
        const { client, params } = yield* setup;
        const prepared = yield* client.walletTransaction.prepare({
          params,
          headers: { "idempotency-key": "tamper" },
          payload: {
            namespace: "eip155",
            chainId: "eip155:1",
            calls: [
              {
                to: EthereumAddress.make("0x4444444444444444444444444444444444444444"),
                value: 0n,
                data: "0x1234",
              },
            ],
          },
        });
        const session = yield* client.sessionKey.create({
          payload: yield* localSessionRequest(params.walletId, ["eip155:1"]),
        });
        const installation = session.installations[0];
        if (!installation) return yield* Effect.die("Missing installation");
        expect(
          yield* client.sessionKey
            .prepareOperation({
              payload: {
                installationId: installation.id,
                kind: "install",
                sponsor: false,
                idempotencyKey: "other-operation",
              },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "OPERATION_BUSY" });
        const db = yield* Database;
        const [encoded] = yield* db.query.walletOperation.findMany();
        if (!encoded) return yield* Effect.die("Missing operation");
        const stored = Schema.decodeSync(WalletOperation)(encoded);
        // Exactly one row exists in this isolated fixture; no signature has been accepted.
        yield* db.update(walletOperation).set({
          data: Schema.encodeSync(WalletOperationData)({
            ...stored.data,
            prepared: {
              ...stored.data.prepared,
              context: {
                ...stored.data.prepared.context,
                calls: [{ to: stored.data.prepared.context.account, value: 1n, data: "0x" }],
              },
            },
          }),
        });
        expect(
          yield* client.walletTransaction
            .complete({
              params,
              payload: { namespace: "eip155" as const, operationId: prepared.operationId },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "APPROVAL_INVALID" });
        expect((yield* db.query.walletOperation.findMany())[0]?.status).toBe("awaiting-signature");
      }),
  );
  it.effect("requires an owner assertion and resumes one durable operation until its receipt", () =>
    Effect.gen(function* () {
      const { client, params } = yield* setup;
      const headers = { "idempotency-key": "primary-test" };
      const prepared = yield* client.walletTransaction.prepare({
        params,
        headers,
        payload: {
          namespace: "eip155",
          chainId: "eip155:1",
          calls: [
            {
              to: EthereumAddress.make("0x4444444444444444444444444444444444444444"),
              value: 0n,
              data: "0x1234",
            },
          ],
        },
      });
      expect(prepared.signing.method).toBe("passkey");
      expect(prepared.priceQuote).toMatchObject({ ethUsd: 3000, usdcUsd: 0.998 });
      expect(
        (yield* client.walletTransaction.prepare({
          params,
          headers,
          payload: {
            namespace: "eip155",
            chainId: "eip155:1",
            calls: [
              {
                to: EthereumAddress.make("0x4444444444444444444444444444444444444444"),
                value: 0n,
                data: "0x1234",
              },
            ],
          },
        })).operationId,
      ).toBe(prepared.operationId);
      expect(
        yield* client.walletTransaction
          .complete({
            params,
            payload: { namespace: "eip155" as const, operationId: prepared.operationId },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "APPROVAL_INVALID" });
      if (prepared.signing.method !== "passkey")
        return yield* Effect.die("Missing passkey options");
      const approval = {
        namespace: "eip155" as const,
        operationId: prepared.operationId,
        response: fixture.authenticator.authenticate({
          challenge: prepared.signing.options.challenge,
          origin: "http://dashboard.test",
          rpId: "dashboard.test",
          counter: 1,
        }),
      };
      expect((yield* client.walletTransaction.complete({ params, payload: approval })).status).toBe(
        "signed",
      );
      expect((yield* client.walletTransaction.complete({ params, payload: approval })).status).toBe(
        "signed",
      );
      const execution = yield* TestEvmExecution;
      yield* execution.setReceiptMode("missing");
      yield* TestClock.adjust(Duration.seconds(2));
      const app = yield* Application;
      expect(yield* app.wallet.transactions.reconcile()).toBe(1);
      expect((yield* client.identity.primaryStatus({ params })).operation?.status).toBe(
        "submitted",
      );
      yield* execution.setReceiptMode("immediate");
      yield* TestClock.adjust(Duration.seconds(16));
      yield* app.wallet.transactions.reconcile();
      const status = yield* client.identity.primaryStatus({ params });
      expect(status.operation?.status).toBe("confirmed");
      expect(status.operation?.transactionHash).toBeTruthy();
      // A receipt alone must never be presented as verified ENS resolution.
      expect(status.verified).toBe(false);
      const db = yield* Database;
      const rows = yield* db.query.walletOperation.findMany();
      expect(rows).toHaveLength(1);
      const audits = (yield* db.query.organizationEvent.findMany()).filter((row) =>
        row.event.startsWith("wallet.operation_"),
      );
      expect(audits.map((row) => row.event).toSorted()).toEqual([
        "wallet.operation_approved",
        "wallet.operation_confirmed",
        "wallet.operation_prepared",
      ]);
    }),
  );

  it.effect("rejects parallel approvals, changed requests, and expired challenges", () =>
    Effect.gen(function* () {
      const { client, params } = yield* setup;
      const prepared = yield* client.walletTransaction.prepare({
        params,
        headers: { "idempotency-key": "first" },
        payload: {
          namespace: "eip155",
          chainId: "eip155:1",
          calls: [
            {
              to: EthereumAddress.make("0x4444444444444444444444444444444444444444"),
              value: 0n,
              data: "0x1234",
            },
          ],
        },
      });
      expect(
        yield* client.walletTransaction
          .prepare({
            params,
            headers: { "idempotency-key": "second" },
            payload: {
              namespace: "eip155",
              chainId: "eip155:1",
              calls: [
                {
                  to: EthereumAddress.make("0x4444444444444444444444444444444444444444"),
                  value: 0n,
                  data: "0x1234",
                },
              ],
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "OPERATION_BUSY" });
      const other = { walletId: WalletId.make("01a00000-0000-7000-8000-000000000099") };
      expect(
        yield* client.walletTransaction
          .prepare({
            params,
            headers: { "idempotency-key": "first" },
            payload: {
              namespace: "eip155",
              chainId: "eip155:1",
              calls: [
                {
                  to: EthereumAddress.make("0x4444444444444444444444444444444444444444"),
                  value: 0n,
                  data: "0xabcd",
                },
              ],
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      expect(
        yield* client.walletTransaction
          .complete({
            params: other,
            payload: { namespace: "eip155" as const, operationId: prepared.operationId },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "OPERATION_UNAVAILABLE" });
      yield* TestClock.adjust(Duration.minutes(20));
      yield* (yield* Application).wallet.transactions.reconcile();
      expect((yield* client.identity.primaryStatus({ params })).operation?.status).toBe("expired");
      expect(
        yield* client.walletTransaction
          .complete({
            params,
            payload: { namespace: "eip155" as const, operationId: prepared.operationId },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "APPROVAL_EXPIRED" });
      expect(
        (yield* client.walletTransaction.prepare({
          params,
          headers: { "idempotency-key": "retry" },
          payload: {
            namespace: "eip155",
            chainId: "eip155:1",
            calls: [
              {
                to: EthereumAddress.make("0x4444444444444444444444444444444444444444"),
                value: 0n,
                data: "0x1234",
              },
            ],
          },
        })).operationId,
      ).not.toBe(prepared.operationId);
    }),
  );
});
