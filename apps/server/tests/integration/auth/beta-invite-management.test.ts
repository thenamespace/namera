import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Metric, Schema } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Database, Repository, TransactionService } from "@namera-ai/database";
import { CreateBetaInvitesRequest } from "@namera-ai/protocol/dto";
import { betaInviteTransitions } from "@namera-ai/telemetry";

import { handledApi } from "../../fixtures/http-api-test.js";
import { resetTestState, testEmail } from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";
import { platformIdentity } from "../../fixtures/platform.js";

const reset = Effect.gen(function* () {
  yield* resetTestState();
  yield* TestClock.setTime(Date.now());
});

layer(TestServerLayer)("beta invite management", (it) => {
  it.effect("creates unique codes once, stores only HMACs and audits every committed invite", () =>
    Effect.gen(function* () {
      yield* reset;
      const owner = yield* platformIdentity();
      const metric = Metric.withAttributes(betaInviteTransitions, { result: "created" });
      const before = yield* Metric.value(metric);
      const created = yield* owner.client.betaInvite.create({ payload: { count: 3 } });
      expect((yield* Metric.value(metric)).count - before.count).toBe(3);
      expect(created.invites).toHaveLength(3);
      expect(new Set(created.invites.map((invite) => invite.code)).size).toBe(3);
      for (const invite of created.invites) {
        expect(invite.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
        expect(new URL(invite.url).searchParams.get("invite")).toBe(invite.code);
        expect(DateTime.toEpochMillis(invite.expiresAt)).toBe(
          DateTime.toEpochMillis(yield* DateTime.now) + 7 * 86400000,
        );
      }
      const db = yield* Database;
      const stored = yield* db.query.betaInvite.findMany();
      expect(stored).toHaveLength(3);
      expect(
        stored.every((row) => !created.invites.some((invite) => invite.code === row.codeHmac)),
      ).toBe(true);
      const listed = yield* owner.client.betaInvite.list({ query: {} });
      expect(listed.entries).toHaveLength(3);
      expect(listed.entries.every((row) => row.status === "active" && row.email === null)).toBe(
        true,
      );
      for (const row of listed.entries) {
        expect(row).not.toHaveProperty("code");
        expect(row).not.toHaveProperty("codeHmac");
      }
      expect(
        (yield* db.query.betaInviteEvent.findMany()).filter((event) => event.event === "created"),
      ).toHaveLength(3);
      expect(
        (yield* db.query.platformEvent.findMany()).filter(
          (event) =>
            event.data.type === "beta-invite.created" && event.actorMemberId === owner.member.id,
        ),
      ).toHaveLength(3);
    }),
  );

  it.effect("binds a single code, validates counts, expiry and batch email at the boundary", () =>
    Effect.gen(function* () {
      yield* reset;
      const owner = yield* platformIdentity();
      const email = testEmail("recipient@example.com");
      yield* owner.client.betaInvite.create({ payload: { count: 1, email, expiresInDays: 30 } });
      const listed = yield* owner.client.betaInvite.list({ query: { email: "RECIPIENT" } });
      expect(listed.entries[0]?.email).toBe(email);
      for (const payload of [
        { count: 0 },
        { count: 51 },
        { count: 1.5 },
        { count: 1, expiresInDays: 0 },
        { count: 1, expiresInDays: 31 },
        { count: 2, email },
      ]) {
        expect(Schema.is(CreateBetaInvitesRequest)(payload)).toBe(false);
      }
      // The typed client rejects invalid payloads before HTTP; send raw JSON to test the server too.
      const handler = yield* HttpRouter.toHttpEffect(HttpApiBuilder.layer(NameraApi));
      let response: HttpServerResponse.HttpServerResponse | undefined;
      yield* HttpEffect.toHandled(handler, (_request, result) =>
        Effect.sync(() => {
          response = result;
        }),
      ).pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          HttpServerRequest.fromWeb(
            new Request("http://api.test/internal/invites", {
              method: "POST",
              headers: { ...owner.headers, "content-type": "application/json" },
              body: JSON.stringify({ count: 2, email }),
            }),
          ),
        ),
        Effect.exit,
      );
      expect(response?.status).toBe(400);
      expect(yield* (yield* Database).query.betaInvite.findMany()).toHaveLength(1);
    }),
  );

  it.effect(
    "permits reads for all roles, writes for operators, and rejects viewers, missing sessions and unsafe origins",
    () =>
      Effect.gen(function* () {
        yield* reset;
        const owner = yield* platformIdentity();
        const operator = yield* platformIdentity("operator@example.com", "operator");
        const viewer = yield* platformIdentity("viewer@example.com", "viewer");
        const created = yield* operator.client.betaInvite.create({ payload: { count: 1 } });
        const invite = created.invites[0];
        if (!invite) return yield* Effect.die("Missing invite");
        const id = invite.id;
        for (const identity of [owner, operator, viewer])
          expect((yield* identity.client.betaInvite.list({ query: {} })).entries).toHaveLength(1);
        expect(
          (yield* viewer.client.betaInvite.create({
            payload: { count: 1 },
            responseMode: "response-only",
          })).status,
        ).toBe(403);
        expect(
          (yield* viewer.client.betaInvite.revoke({
            params: { id },
            responseMode: "response-only",
          })).status,
        ).toBe(403);
        const anonymous = yield* handledApi(NameraApi);
        expect(
          (yield* anonymous.betaInvite.list({ query: {}, responseMode: "response-only" })).status,
        ).toBe(401);
        for (const origin of [undefined, "https://evil.test"]) {
          const client = yield* handledApi(NameraApi, {
            headers: { cookie: owner.headers.cookie, ...(origin ? { origin } : {}) },
          });
          expect(
            (yield* client.betaInvite.create({
              payload: { count: 1 },
              responseMode: "response-only",
            })).status,
          ).toBe(403);
        }
        yield* owner.client.platform.changeStatus({
          params: { id: operator.member.id },
          payload: { status: "suspended" },
        });
        expect(
          (yield* operator.client.betaInvite.list({ query: {}, responseMode: "response-only" }))
            .status,
        ).toBe(403);
        yield* TestClock.adjust("11 minutes");
        expect(
          (yield* owner.client.betaInvite.create({
            payload: { count: 1 },
            responseMode: "response-only",
          })).status,
        ).toBe(403);
        expect(
          (yield* owner.client.betaInvite.revoke({ params: { id }, responseMode: "response-only" }))
            .status,
        ).toBe(403);
      }),
  );

  it.effect(
    "revokes once, filters terminal states, paginates without overlap and returns redeemer metadata",
    () =>
      Effect.gen(function* () {
        yield* reset;
        const owner = yield* platformIdentity();
        const repository = yield* Repository;
        const created = yield* owner.client.betaInvite.create({
          payload: { count: 3, expiresInDays: 1 },
        });
        const [revoked, redeemed, expired] = created.invites;
        if (!revoked || !redeemed || !expired) return yield* Effect.die("Missing invites");
        const metric = Metric.withAttributes(betaInviteTransitions, { result: "revoked" });
        const before = yield* Metric.value(metric);
        const results = yield* Effect.all(
          [0, 1, 2].map(() => owner.client.betaInvite.revoke({ params: { id: revoked.id } })),
          { concurrency: "unbounded" },
        );
        expect(results.filter((result) => result.revoked)).toHaveLength(1);
        expect((yield* Metric.value(metric)).count - before.count).toBe(1);
        yield* repository.auth.user.updateMetadata(owner.user.id, {
          version: 1,
          name: "Invite recipient",
          image: { type: "emoji", value: "👤" },
        });
        yield* repository.auth.betaInvite.redeem(redeemed.id, owner.user.id, yield* DateTime.now);
        expect(
          (yield* owner.client.betaInvite.revoke({ params: { id: redeemed.id } })).revoked,
        ).toBe(false);
        const used = yield* owner.client.betaInvite.list({ query: { status: "redeemed" } });
        expect(used.entries[0]?.redeemedByMetadata?.name).toBe("Invite recipient");
        expect(used.entries[0]?.redeemedByEmail).toBe(owner.user.email);
        const page = yield* owner.client.betaInvite.list({ query: { limit: 2 } });
        expect(page.entries).toHaveLength(2);
        expect(page.nextCursor).not.toBeNull();
        if (!page.nextCursor) return yield* Effect.die("Missing next cursor");
        const next = yield* owner.client.betaInvite.list({
          query: { limit: 2, cursor: page.nextCursor },
        });
        expect(next.entries).toHaveLength(1);
        expect(next.nextCursor).toBeNull();
        expect(new Set([...page.entries, ...next.entries].map((row) => row.id)).size).toBe(3);
        yield* TestClock.adjust("2 days");
        expect(
          (yield* owner.client.betaInvite.list({ query: { status: "expired" } })).entries.map(
            (row) => row.id,
          ),
        ).toEqual([expired.id]);
        expect(
          (yield* owner.client.betaInvite.list({ query: { status: "revoked" } })).entries.map(
            (row) => row.id,
          ),
        ).toEqual([revoked.id]);
        // Database session defaults use wall time; exercise the expiry predicate against the test clock directly.
        expect(
          yield* repository.auth.betaInvite.revoke(expired.id, yield* DateTime.now),
        ).toBeUndefined();
        const db = yield* Database;
        expect(
          (yield* db.query.betaInviteEvent.findMany()).filter((event) => event.event === "revoked"),
        ).toHaveLength(1);
        expect(
          (yield* db.query.platformEvent.findMany()).filter(
            (event) => event.data.type === "beta-invite.revoked",
          ),
        ).toHaveLength(1);
      }),
  );

  it.effect("allows only one terminal outcome when redemption races revocation", () =>
    Effect.gen(function* () {
      yield* reset;
      const owner = yield* platformIdentity();
      const repository = yield* Repository;
      const transactions = yield* TransactionService;
      const { invites } = yield* owner.client.betaInvite.create({ payload: { count: 1 } });
      const invite = invites[0];
      if (!invite) return yield* Effect.die("Missing invite");
      const id = invite.id;
      yield* Effect.all(
        [
          owner.client.betaInvite.revoke({ params: { id } }),
          transactions.run(
            Effect.gen(function* () {
              const now = yield* DateTime.now;
              if (yield* repository.auth.betaInvite.lockActive(id, now)) {
                yield* repository.auth.betaInvite.redeem(id, owner.user.id, now);
                yield* repository.auth.betaInvite.appendEvent(id, "redeemed");
              }
            }),
          ),
        ],
        { concurrency: "unbounded" },
      );
      const rows = yield* (yield* Database).query.betaInvite.findMany();
      expect(rows).toHaveLength(1);
      expect(Boolean(rows[0]?.revokedAt) !== Boolean(rows[0]?.redeemedAt)).toBe(true);
    }),
  );
});
