import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { NameraApi } from "@namera-ai/api";
import { Database } from "@namera-ai/database";
import { Ens, TestEns } from "@namera-ai/ens";

import { handledApi } from "../../fixtures/http-api-test.js";
import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";
import { createTestPasskeyWallet } from "../../fixtures/local-session.js";

const setup = Effect.gen(function* () {
  yield* resetTestState();
  const login = yield* makeTestApiClient;
  const author = yield* signIn(login, testEmail("identity@example.com"));
  const client = yield* handledApi(NameraApi, {
    headers: { cookie: `auth-token=${author.cookie.value}`, origin: "http://dashboard.test" },
  });
  const wallet = yield* createTestPasskeyWallet(client);
  return { client, wallet, author, params: { walletId: wallet.id, label: "treasury" } };
});

layer(TestServerLayer)("identities", (it) => {
  it.effect(
    "creates account-owned names once and reads Namespace records without identity persistence",
    () =>
      Effect.gen(function* () {
        const { client, wallet, params } = yield* setup;
        const created = yield* client.identity.create({ params, payload: { label: params.label } });
        expect(created).toMatchObject({
          fullName: "treasury.namera.id",
          owner: wallet.address,
          addresses: { "60": wallet.address },
          records: {},
        });
        expect(yield* client.identity.create({ params, payload: { label: params.label } })).toEqual(
          created,
        );
        expect(
          yield* client.identity
            .create({ params, payload: { label: "another" } })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "ACCOUNT_IDENTITY_EXISTS" });
        const list = yield* client.identity.list({ params, query: {} });
        expect(list.totalItems).toBe(1);
        expect(list.items[0]?.fullName).toBe(created.fullName);
        const ens = yield* Ens;
        yield* ens.addTextRecord(created.fullName, "description", "Changed at Namespace");
        expect((yield* client.identity.get({ params })).texts.description).toBe(
          "Changed at Namespace",
        );
        const db = yield* Database;
        const audits = (yield* db.query.organizationEvent.findMany()).filter(
          (event) => event.event === "identity.changed",
        );
        expect(audits).toHaveLength(1);
        expect(audits[0]?.data).toEqual({
          version: 1,
          name: created.fullName,
          action: "created",
          applied: 1,
        });
      }),
  );

  it.effect(
    "edits and removes individual records without replacing unrelated provider records",
    () =>
      Effect.gen(function* () {
        const { client, params } = yield* setup;
        yield* client.identity.create({ params, payload: { label: params.label } });
        yield* client.identity.updateRecords({
          params,
          payload: {
            changes: [
              { type: "text", key: "name", value: "Treasury" },
              { type: "text", key: "description", value: "Payments" },
              { type: "data", key: "preferences", value: { version: 1, enabled: true } },
            ],
          },
        });
        const result = yield* client.identity.updateRecords({
          params,
          payload: { changes: [{ type: "text", key: "name", value: null }] },
        });
        expect(result.texts).toEqual({ description: "Payments" });
        expect(result.records).toEqual({ preferences: { version: 1, enabled: true } });
        expect(Object.keys(result.addresses)).toContain("60");
        expect(
          yield* client.identity
            .updateRecords({
              params,
              payload: {
                changes: [
                  { type: "text", key: "description", value: "Must not apply" },
                  { type: "address", key: "eth", value: "invalid" },
                ],
              },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "INVALID_RECORD" });
        expect((yield* client.identity.get({ params })).texts.description).toBe("Payments");
        yield* (yield* TestEns).failNextWrite;
        expect(
          yield* client.identity
            .updateRecords({
              params,
              payload: { changes: [{ type: "text", key: "name", value: "Failure" }] },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "ENS_UNAVAILABLE" });
      }),
  );

  it.effect("enforces tenant scope, provider ownership, authentication and mutation origin", () =>
    Effect.gen(function* () {
      const { client, params, author } = yield* setup;
      yield* client.identity.create({ params, payload: { label: params.label } });
      const ens = yield* Ens;
      yield* ens.createSubname({
        parentName: "namera.id",
        label: "foreign",
        owner: "0x1111111111111111111111111111111111111111",
      });
      expect(
        yield* client.identity.get({ params: { ...params, label: "foreign" } }).pipe(Effect.flip),
      ).toMatchObject({ code: "IDENTITY_UNAVAILABLE" });
      expect(
        yield* client.identity.create({ params, payload: { label: "foreign" } }).pipe(Effect.flip),
      ).toMatchObject({ code: "NAME_UNAVAILABLE" });
      const wrongOrigin = yield* handledApi(NameraApi, {
        headers: { cookie: `auth-token=${author.cookie.value}`, origin: "https://evil.test" },
      });
      expect(
        (yield* wrongOrigin.identity.updateRecords({
          params,
          payload: { changes: [{ type: "text", key: "name", value: "Blocked" }] },
          responseMode: "response-only",
        })).status,
      ).toBe(403);
      const other = yield* makeTestApiClient;
      yield* signIn(other, testEmail("identity-other@example.com"));
      expect(yield* other.identity.get({ params }).pipe(Effect.flip)).toMatchObject({
        code: "WALLET_NOT_FOUND",
      });
      const anonymous = yield* handledApi(NameraApi, { headers: { cookie: "auth-token=invalid" } });
      expect(
        (yield* anonymous.identity.list({ params, query: {}, responseMode: "response-only" }))
          .status,
      ).toBe(401);
    }),
  );
});
