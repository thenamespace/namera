import { readFileSync } from "node:fs";

import { expect, layer } from "@effect/vitest";
import { DateTime, Effect } from "effect";

import { makeBillingPeriods, makeBillingMetering } from "@namera-ai/application";
import { Database, Repository } from "@namera-ai/database";

import {
  createOrganization,
  makeTestApiClient,
  resetTestState,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";
import { seedLegacyBilling } from "../../fixtures/legacy-billing.js";

const rolloutSql = readFileSync(
  new URL(
    "../../../../../packages/database/migrations/20261010121514_free-v2-rollout/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

layer(TestServerLayer)("Free v2 rollout", (it) => {
  it.effect("keeps the active period, migrates once at renewal, and settles historical holds", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("v2-renewal@example.com"));
      const organizationId = owner.actor.organization.id;
      yield* seedLegacyBilling(organizationId);
      const db = yield* Database;
      const repository = yield* Repository;
      const periods = yield* makeBillingPeriods;
      const metering = yield* makeBillingMetering;
      const hold = yield* metering.reserve({
        organizationId,
        meterKey: "signature",
        amount: 1500n,
        sourceType: "manual-adjustment",
        sourceId: "legacy-hold",
        expiresAt: DateTime.add(yield* DateTime.now, { months: 2 }),
      });
      yield* db.execute(rolloutSql);
      const before = yield* client.billing.get();
      expect(before.planVersion).toBe(1);
      expect(before.scheduledChange?.effectiveAt).toEqual(before.period.endsAt);
      expect(before.meters.find(({ key }) => key === "signature")?.hardLimitAmount).toBe(10000n);
      const next = yield* periods.current(organizationId, before.period.endsAt);
      expect(next.planVersion).toBe(2);
      expect(
        (yield* repository.billing.subscription.findCurrent(organizationId))?.planVersion,
      ).toBe(2);
      expect(
        (yield* repository.billing.meterBalance.find(organizationId, next.id, "signature"))
          ?.hardLimitAmount,
      ).toBe(1000n);
      yield* metering.settle({ organizationId, reservationId: hold.id, amount: 1500n });
      expect(
        yield* repository.billing.meterBalance.find(organizationId, hold.periodId, "signature"),
      ).toMatchObject({ consumedAmount: 1500n, reservedAmount: 0n, hardLimitAmount: 10000n });
      yield* periods.current(organizationId, DateTime.add(next.endsAt, { seconds: 1 }));
      expect(
        (yield* repository.audit.organization.findForOrganization(organizationId)).filter(
          ({ event }) => event === "billing.plan_changed",
        ),
      ).toHaveLength(1);
    }),
  );

  it.effect("catches up missed periods under v1 and only switches after deployment", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("v2-catchup@example.com"));
      const organizationId = owner.actor.organization.id;
      yield* seedLegacyBilling(organizationId);
      const db = yield* Database;
      yield* db.execute(
        "UPDATE billing.period SET starts_at = '2026-01-31T00:00:00Z', ends_at = '2026-02-28T00:00:00Z'",
      );
      yield* db.execute(
        `UPDATE billing.subscription SET data = '{"freeV2RolloutAt":"2026-04-10T00:00:00Z"}'`,
      );
      const periods = yield* makeBillingPeriods;
      const repository = yield* Repository;
      const current = yield* periods.current(
        organizationId,
        DateTime.makeUnsafe("2026-05-15T00:00:00Z"),
      );
      const history = yield* repository.billing.period.listForSubscription(
        organizationId,
        current.subscriptionId,
      );
      expect(history.toReversed().map(({ planVersion }) => planVersion)).toEqual([1, 1, 1, 2]);
      expect(DateTime.formatIso(current.startsAt)).toBe("2026-04-30T00:00:00.000Z");
      expect(DateTime.formatIso(current.endsAt)).toBe("2026-05-31T00:00:00.000Z");
    }),
  );

  it.effect(
    "limits owned organizations to three including Personal without changing existing ones",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        yield* signIn(client, testEmail("v2-orgs@example.com"));
        yield* createOrganization(client, "Second");
        yield* createOrganization(client, "Third");
        const failure = yield* createOrganization(client, "Fourth").pipe(Effect.flip);
        expect(failure).toMatchObject({ code: "LIMIT_EXCEEDED", limit: "ownedOrganizations" });
        expect(yield* client.organization.list()).toHaveLength(3);
      }),
  );
});
