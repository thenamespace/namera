import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

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
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("dashboard-overview@example.com"));

      const empty = yield* client.dashboard.getOverview();
      expect(empty).toMatchObject({
        organizationId: owner.actor.organization.id,
        resources: {
          accounts: { total: 0, active: 0, included: 5, withoutActiveSessionKeys: 0 },
          sessionKeys: { total: 0, active: 0 },
        },
        recentExecutions: [],
        attention: [],
      });
      expect(empty.namespaces).toHaveLength(1);
      expect(empty.namespaces[0]).toMatchObject({
        namespace: "eip155",
        activity: { windowDays: 30 },
      });
      expect(empty.namespaces[0]?.activity.series).toHaveLength(30);

      const fixture = yield* createExecutionFixture(client, "overview");
      yield* setAuthToken();
      yield* setApiKey(fixture.apiKey.key);
      yield* executeFixture(client, fixture.wallet, "dashboard-overview-execution");
      yield* setApiKey();
      yield* setAuthToken(owner.cookie.value);

      const overview = yield* client.dashboard.getOverview();
      expect(overview.resources).toMatchObject({
        accounts: { total: 1, active: 1, included: 5, withoutActiveSessionKeys: 0 },
        sessionKeys: { total: 1, active: 1 },
      });
      expect(overview.recentExecutions).toHaveLength(1);
      expect(overview.recentExecutions[0]).toMatchObject({
        wallet: { id: fixture.wallet.id },
        sessionKey: { id: fixture.sessionKey.id },
        details: { namespace: "eip155" },
      });
      expect(
        overview.namespaces[0]?.activity.series.reduce(
          (total, point) => total + point.executions,
          0,
        ),
      ).toBe(1);
    }),
  );
});
