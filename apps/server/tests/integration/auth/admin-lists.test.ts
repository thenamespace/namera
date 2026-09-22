import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Passkeys } from "@namera-ai/passkeys";

import { handledApi } from "../../fixtures/http-api-test.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";

const adminToken = "test-only-admin-list-token-32-characters-long";
const AdminLayer = makeTestServerLayer(
  {},
  Passkeys.testLayer,
  makeTestConfigLayer({ ADMIN_TOKEN: adminToken }),
);
const adminClient = handledApi(NameraApi, { headers: { authorization: `Bearer ${adminToken}` } });

layer(AdminLayer)("operator invite list", (it) => {
  it.effect("reports a derived status for every lifecycle state", () =>
    Effect.gen(function* () {
      const admin = yield* adminClient;

      const active = yield* admin.betaInvite.create({ payload: { count: 1, expiresInDays: 7 } });
      const revoked = yield* admin.betaInvite.create({ payload: { count: 1, expiresInDays: 7 } });
      const shortLived = yield* admin.betaInvite.create({
        payload: { count: 1, expiresInDays: 1 },
      });
      const revokedId = revoked.invites[0]?.id ?? "";
      yield* admin.betaInvite.revoke({ params: { id: revokedId } });

      const statusOf = Effect.fn(function* (id: string) {
        const page = yield* admin.betaInvite.list({ query: {} });
        return page.entries.find((entry) => entry.id === id)?.status;
      });

      expect(yield* statusOf(active.invites[0]?.id ?? "")).toBe("active");
      expect(yield* statusOf(revokedId)).toBe("revoked");

      // Expiry is derived against the same clock that governs redemption, so
      // moving the clock past a one-day invite reports it as expired.
      const expiredId = shortLived.invites[0]?.id ?? "";
      expect(yield* statusOf(expiredId)).toBe("active");
      yield* TestClock.adjust("2 days");
      expect(yield* statusOf(expiredId)).toBe("expired");
      expect(yield* statusOf(revokedId)).toBe("revoked");

      const stillActive = yield* admin.betaInvite.list({ query: { status: "active" } });
      expect(stillActive.entries.map((entry) => entry.id)).not.toContain(expiredId);
      expect(stillActive.entries.map((entry) => entry.id)).not.toContain(revokedId);
    }),
  );

  it.effect("filters by status and never returns the code hash", () =>
    Effect.gen(function* () {
      const admin = yield* adminClient;
      const created = yield* admin.betaInvite.create({ payload: { count: 2, expiresInDays: 7 } });
      yield* admin.betaInvite.revoke({ params: { id: created.invites[0]?.id ?? "" } });

      const revokedPage = yield* admin.betaInvite.list({ query: { status: "revoked" } });
      expect(revokedPage.entries.length).toBeGreaterThan(0);
      for (const entry of revokedPage.entries) {
        expect(entry.status).toBe("revoked");
        expect(entry).not.toHaveProperty("codeHmac");
      }
    }),
  );

  it.effect("pages with a cursor, newest first", () =>
    Effect.gen(function* () {
      const admin = yield* adminClient;
      yield* admin.betaInvite.create({ payload: { count: 3, expiresInDays: 7 } });

      const first = yield* admin.betaInvite.list({ query: { limit: 2 } });
      expect(first.entries).toHaveLength(2);
      expect(first.nextCursor).not.toBeNull();

      const second = yield* admin.betaInvite.list({
        query: { limit: 2, cursor: first.nextCursor ?? "" },
      });
      const firstIds = first.entries.map((entry) => entry.id);
      for (const entry of second.entries) expect(firstIds).not.toContain(entry.id);
    }),
  );

  it.effect("rejects a request without the admin bearer", () =>
    Effect.gen(function* () {
      const anonymous = yield* handledApi(NameraApi);
      expect(
        (yield* anonymous.betaInvite.list({ query: {}, responseMode: "response-only" })).status,
      ).toBe(401);
    }),
  );
});

layer(AdminLayer)("operator user list", (it) => {
  it.effect("rejects a request without the admin bearer", () =>
    Effect.gen(function* () {
      const anonymous = yield* handledApi(NameraApi);
      expect(
        (yield* anonymous.adminUser.list({ query: {}, responseMode: "response-only" })).status,
      ).toBe(401);
    }),
  );

  it.effect("lists users and searches by email", () =>
    Effect.gen(function* () {
      const admin = yield* adminClient;
      const page = yield* admin.adminUser.list({ query: {} });
      expect(Array.isArray(page.entries)).toBe(true);

      const missing = yield* admin.adminUser.list({
        query: { search: "no-such-operator-account" },
      });
      expect(missing.entries).toEqual([]);
    }),
  );
});
