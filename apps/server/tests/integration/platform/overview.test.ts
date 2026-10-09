import { describe, expect, it } from "@effect/vitest";
import { Clock, DateTime, Effect, Schema } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Database, Repository } from "@namera-ai/database";
import { GetAdminOverviewRequest } from "@namera-ai/protocol/dto";

import { handledApi } from "../../fixtures/http-api-test.js";
import { resetTestState, testEmail } from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";
import { platformIdentity } from "../../fixtures/platform.js";

const initialize = Effect.gen(function* () {
  yield* resetTestState();
  yield* TestClock.setTime(yield* TestClock.withLive(Clock.currentTimeMillis));
});

describe("admin overview", () => {
  it.effect("serves zero-filled UTC ranges and lifetime counts independently of the period", () =>
    Effect.gen(function* () {
      yield* initialize;
      const repository = yield* Repository;
      const db = yield* Database;
      const now = DateTime.makeUnsafe("2026-10-08T23:30:00Z");
      yield* TestClock.setTime(DateTime.toEpochMillis(now));
      const owner = yield* platformIdentity();
      yield* db.execute("update auth.\"user\" set created_at = '2026-01-01T00:00:00Z'");
      for (const [email, createdAt] of [
        ["old@example.com", "2026-06-01T00:00:00Z"],
        ["ninety@example.com", "2026-07-11T00:00:00Z"],
        ["thirty@example.com", "2026-09-09T00:00:00Z"],
        ["seven@example.com", "2026-10-02T00:00:00Z"],
        ["today@example.com", "2026-10-08T23:00:00Z"],
        ["future@example.com", "2026-10-09T00:00:00Z"],
      ] as const) {
        yield* repository.auth.waitlist.join(testEmail(email));
        yield* db.execute(
          `update auth.waitlist set created_at = '${createdAt}'::timestamptz where email = '${email}'`,
        );
      }
      const first = yield* owner.client.adminOverview.get({ query: {} });
      expect(first.period).toBe("30d");
      expect(first.totals).toEqual({
        users: 1,
        waitlist: 5,
        accounts: 0,
        sessionKeys: 0,
        executions: 0,
        signatures: 0,
      });
      expect(first.periodCounts.waitlist).toBe(3);
      expect(first.periodCounts.users).toBe(0);
      expect(first.activity).toHaveLength(30);
      expect(first.activity[0]?.date).toBe("2026-09-09");
      expect(first.activity.at(-1)).toMatchObject({ date: "2026-10-08", waitlist: 1 });
      expect(first.current.pendingWaitlist).toBe(5);
      const week = yield* owner.client.adminOverview.get({ query: { period: "7d" } });
      const quarter = yield* owner.client.adminOverview.get({ query: { period: "90d" } });
      expect(week.activity).toHaveLength(7);
      expect(week.activity[0]).toMatchObject({ date: "2026-10-02", waitlist: 1 });
      expect(week.periodCounts.waitlist).toBe(2);
      expect(quarter.activity).toHaveLength(90);
      expect(quarter.activity[0]).toMatchObject({ date: "2026-07-11", waitlist: 1 });
      expect(quarter.periodCounts.waitlist).toBe(4);
      expect(week.totals).toEqual(quarter.totals);
      expect(week.generatedAt).toEqual(quarter.generatedAt);
      for (const period of ["1d", "365d", "", "../"]) {
        expect(Schema.is(GetAdminOverviewRequest)({ period })).toBe(false);
      }
    }).pipe(Effect.provide(TestServerLayer)),
  );

  it.effect(
    "shares cached results across periods, refreshes at sixty seconds, and rechecks access",
    () =>
      Effect.gen(function* () {
        yield* initialize;
        const owner = yield* platformIdentity();
        const operator = yield* platformIdentity("operator@example.com", "operator");
        const viewer = yield* platformIdentity("viewer@example.com", "viewer");
        yield* TestClock.adjust("1 minute");
        const snapshots = yield* Effect.all(
          [owner, operator, viewer].map((identity) =>
            identity.client.adminOverview.get({ query: {} }),
          ),
          { concurrency: "unbounded" },
        );
        expect(snapshots.map((snapshot) => snapshot.totals.users)).toEqual([3, 3, 3]);
        const initial = snapshots[0];
        if (!initial) throw new Error("Expected an overview snapshot");
        expect(
          snapshots.every(
            (snapshot) =>
              DateTime.toEpochMillis(snapshot.generatedAt) ===
              DateTime.toEpochMillis(initial.generatedAt),
          ),
        ).toBe(true);
        const repository = yield* Repository;
        yield* repository.auth.waitlist.join(testEmail("new@example.com"));
        yield* TestClock.adjust("59 seconds");
        expect(
          (yield* viewer.client.adminOverview.get({ query: { period: "7d" } })).totals.waitlist,
        ).toBe(0);
        yield* owner.client.platform.changeStatus({
          params: { id: viewer.member.id },
          payload: { status: "suspended" },
        });
        expect(
          (yield* viewer.client.adminOverview.get({ query: {}, responseMode: "response-only" }))
            .status,
        ).toBe(403);
        yield* TestClock.adjust("1 second");
        const refreshed = yield* operator.client.adminOverview.get({ query: { period: "90d" } });
        expect(refreshed.totals.waitlist).toBe(1);
        expect(DateTime.toEpochMillis(refreshed.generatedAt)).toBeGreaterThan(
          DateTime.toEpochMillis(initial.generatedAt),
        );
        const anonymous = yield* handledApi(NameraApi);
        const response = yield* anonymous.adminOverview.get({
          query: {},
          responseMode: "response-only",
        });
        expect(response.status).toBe(401);
        yield* TestClock.adjust("31 days");
        expect(
          (yield* owner.client.adminOverview.get({ query: {}, responseMode: "response-only" }))
            .status,
        ).toBe(401);
      }).pipe(Effect.provide(TestServerLayer)),
  );
});
