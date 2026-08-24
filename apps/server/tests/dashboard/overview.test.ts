import { expect, layer } from "@effect/vitest";
import { Clock, Effect } from "effect";
import { TestClock } from "effect/testing";

import { createExecutionFixture, executeFixture } from "../execution/helpers.js";
import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

layer(TestServerLayer)("dashboard overview route", (it) => {
  it.effect("returns a namespace-aware organization snapshot", () =>
    Effect.gen(function* () {
      // Persisted operation timestamps use the database clock, so the overview
      // window must not remain at the test clock's Unix-epoch default.
      yield* TestClock.setTime(yield* TestClock.withLive(Clock.currentTimeMillis));
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("dashboard-overview@example.com"));

      const empty = yield* client.dashboard.getOverview();
      expect(empty).toMatchObject({
        organizationId: owner.actor.organization.id,
        resources: {
          accounts: { total: 0, active: 0 },
          sessionKeys: { total: 0, active: 0 },
        },
      });
      expect(empty.namespaces).toHaveLength(1);
      expect(empty.namespaces[0]).toMatchObject({
        namespace: "eip155",
        totals: { executions: 0n, signatures: 0n },
        executionSources: [],
      });
      expect(empty.namespaces[0]?.activity.daily.points).toHaveLength(14);
      expect(empty.namespaces[0]?.activity.weekly.points).toHaveLength(12);
      expect(empty.namespaces[0]?.activity.monthly.points).toHaveLength(12);

      const fixture = yield* createExecutionFixture(client, "overview");
      yield* setAuthToken();
      yield* setApiKey(fixture.apiKey.key);
      yield* executeFixture(client, fixture.wallet, "dashboard-overview-execution");
      yield* setApiKey();
      yield* setAuthToken(owner.cookie.value);

      const overview = yield* client.dashboard.getOverview();
      expect(overview.resources).toMatchObject({
        accounts: { total: 1, active: 1 },
        sessionKeys: { total: 1, active: 1 },
      });
      expect(overview.namespaces[0]?.totals.executions).toBe(1n);
      expect(overview.namespaces[0]?.executionSources).toEqual([
        { actorType: "api-key", count: 1 },
      ]);
      for (const series of Object.values(overview.namespaces[0]?.activity ?? {})) {
        expect(series.points.reduce((total, point) => total + point.executions, 0)).toBe(1);
      }
    }),
  );
});
