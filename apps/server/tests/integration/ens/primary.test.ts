import { expect, layer } from "@effect/vitest";
import { Duration, Effect, Schema } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { Database, walletOperation } from "@namera-ai/database";
import { TestEvmExecution } from "@namera-ai/evm";
import { EthereumAddress } from "@namera-ai/protocol";
import { WalletOperation, WalletOperationData } from "@namera-ai/protocol/model";

import { handledApi } from "../../fixtures/http-api-test.js";
import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture(
  {},
  {
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
  return { client, params };
});

layer(fixture.layer)("Ethereum primary identity", (it) => {
  it.effect(
    "rejects a substituted stored call and excludes concurrent session-key owner operations",
    () =>
      Effect.gen(function* () {
        const { client, params } = yield* setup;
        const prepared = yield* client.identity.preparePrimary({
          params,
          payload: { idempotencyKey: "tamper" },
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
          yield* client.identity
            .approvePrimary({ params, payload: { operationId: prepared.operationId } })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "APPROVAL_INVALID" });
        expect((yield* db.query.walletOperation.findMany())[0]?.status).toBe("awaiting-signature");
      }),
  );
  it.effect("requires an owner assertion and resumes one durable operation until its receipt", () =>
    Effect.gen(function* () {
      const { client, params } = yield* setup;
      const payload = { idempotencyKey: "primary-test" };
      const prepared = yield* client.identity.preparePrimary({ params, payload });
      expect(prepared.approval).toBe("passkey");
      expect((yield* client.identity.preparePrimary({ params, payload })).operationId).toBe(
        prepared.operationId,
      );
      expect(
        yield* client.identity
          .approvePrimary({ params, payload: { operationId: prepared.operationId } })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "APPROVAL_INVALID" });
      if (!prepared.options) return yield* Effect.die("Missing passkey options");
      const approval = {
        operationId: prepared.operationId,
        response: fixture.authenticator.authenticate({
          challenge: prepared.options.challenge,
          origin: "http://dashboard.test",
          rpId: "dashboard.test",
          counter: 1,
        }),
      };
      expect((yield* client.identity.approvePrimary({ params, payload: approval })).status).toBe(
        "signed",
      );
      expect((yield* client.identity.approvePrimary({ params, payload: approval })).status).toBe(
        "signed",
      );
      const execution = yield* TestEvmExecution;
      yield* execution.setReceiptMode("missing");
      yield* TestClock.adjust(Duration.seconds(2));
      const app = yield* Application;
      expect(yield* app.ens.reconcilePrimary()).toBe(1);
      expect((yield* client.identity.primaryStatus({ params })).operation?.status).toBe(
        "submitted",
      );
      yield* execution.setReceiptMode("immediate");
      yield* TestClock.adjust(Duration.seconds(16));
      yield* app.ens.reconcilePrimary();
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

  it.effect("rejects parallel approvals, mismatched names, and expired challenges", () =>
    Effect.gen(function* () {
      const { client, params } = yield* setup;
      const prepared = yield* client.identity.preparePrimary({
        params,
        payload: { idempotencyKey: "first" },
      });
      expect(
        yield* client.identity
          .preparePrimary({ params, payload: { idempotencyKey: "second" } })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "OPERATION_BUSY" });
      const other = { ...params, label: "other" };
      yield* client.identity.create({ params: other, payload: { label: other.label } });
      expect(
        yield* client.identity
          .preparePrimary({ params: other, payload: { idempotencyKey: "first" } })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      expect(
        yield* client.identity
          .approvePrimary({ params: other, payload: { operationId: prepared.operationId } })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "OPERATION_UNAVAILABLE" });
      yield* TestClock.adjust(Duration.minutes(20));
      yield* (yield* Application).ens.reconcilePrimary();
      expect((yield* client.identity.primaryStatus({ params })).operation?.status).toBe("expired");
      expect(
        yield* client.identity
          .approvePrimary({ params, payload: { operationId: prepared.operationId } })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "APPROVAL_EXPIRED" });
      expect(
        (yield* client.identity.preparePrimary({ params, payload: { idempotencyKey: "retry" } }))
          .operationId,
      ).not.toBe(prepared.operationId);
    }),
  );
});
