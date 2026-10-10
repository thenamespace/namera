import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Exit } from "effect";

import {
  makeBillingMetering,
  makeBillingPeriods,
  upgradeExistingFreeSubscriptions,
} from "@namera-ai/application";
import { Repository, TransactionService } from "@namera-ai/database";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";
import { seedLegacyBilling } from "../../fixtures/legacy-billing.js";

layer(TestServerLayer)("Immediate Free v2 startup upgrade", (it) => {
  it.effect("preserves usage, holds and anniversary, skips v2, and upgrades only once", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("startup-upgrade@example.com"));
      const organizationId = owner.actor.organization.id;
      yield* seedLegacyBilling(organizationId);
      const before = yield* client.billing.get();
      const metering = yield* makeBillingMetering;
      const consumed = yield* metering.reserve({
        organizationId,
        meterKey: "signature",
        amount: 10n,
        sourceType: "manual-adjustment",
        sourceId: "startup-consumed",
        expiresAt: DateTime.add(yield* DateTime.now, { days: 2 }),
      });
      yield* metering.settle({ organizationId, reservationId: consumed.id, amount: 10n });
      const hold = yield* metering.reserve({
        organizationId,
        meterKey: "signature",
        amount: 20n,
        sourceType: "manual-adjustment",
        sourceId: "startup-hold",
        expiresAt: DateTime.add(yield* DateTime.now, { days: 2 }),
      });
      expect(yield* upgradeExistingFreeSubscriptions()).toEqual({ upgraded: 1, skipped: 0 });
      const after = yield* client.billing.get();
      expect(after.planVersion).toBe(2);
      expect(after.period).toEqual(before.period);
      expect(after.scheduledChange).toBeUndefined();
      expect(after.meters.find(({ key }) => key === "signature")).toMatchObject({
        includedAmount: 1000n,
        hardLimitAmount: 1000n,
        consumedAmount: 10n,
        reservedAmount: 20n,
      });
      expect(yield* upgradeExistingFreeSubscriptions()).toEqual({ upgraded: 0, skipped: 0 });
      yield* metering.settle({ organizationId, reservationId: hold.id, amount: 20n });
      const repository = yield* Repository;
      expect(
        (yield* repository.billing.subscription.findCurrent(organizationId))?.data,
      ).toHaveProperty("freeV2UpgradedAt");
      expect(
        (yield* repository.audit.organization.findForOrganization(organizationId)).filter(
          ({ event }) => event === "billing.plan_changed",
        ),
      ).toHaveLength(1);
    }),
  );

  it.effect("retains over-limit commitments and restores standard limits at renewal", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("startup-over-limit@example.com"));
      const organizationId = owner.actor.organization.id;
      yield* seedLegacyBilling(organizationId);
      const metering = yield* makeBillingMetering;
      const hold = yield* metering.reserve({
        organizationId,
        meterKey: "signature",
        amount: 1500n,
        sourceType: "manual-adjustment",
        sourceId: "over-limit-hold",
        expiresAt: DateTime.add(yield* DateTime.now, { months: 2 }),
      });
      yield* upgradeExistingFreeSubscriptions();
      const billing = yield* client.billing.get();
      expect(billing.meters.find(({ key }) => key === "signature")).toMatchObject({
        includedAmount: 1000n,
        hardLimitAmount: 1500n,
        reservedAmount: 1500n,
        remainingAmount: 0n,
      });
      const denied = yield* metering
        .reserve({
          organizationId,
          meterKey: "signature",
          amount: 1n,
          sourceType: "manual-adjustment",
          sourceId: "over-limit-new",
          expiresAt: DateTime.add(yield* DateTime.now, { days: 1 }),
        })
        .pipe(Effect.flip);
      expect(denied).toMatchObject({ _tag: "BillingError", code: "LIMIT_EXCEEDED" });
      const periods = yield* makeBillingPeriods;
      const next = yield* periods.current(organizationId, billing.period.endsAt);
      yield* metering.settle({ organizationId, reservationId: hold.id, amount: 1500n });
      const repository = yield* Repository;
      expect(
        yield* repository.billing.meterBalance.find(organizationId, next.id, "signature"),
      ).toMatchObject({ includedAmount: 1000n, hardLimitAmount: 1000n, consumedAmount: 0n });
      expect(
        yield* repository.billing.meterBalance.find(organizationId, hold.periodId, "signature"),
      ).toMatchObject({ consumedAmount: 1500n, reservedAmount: 0n });
    }),
  );

  it.effect("rolls back the marker, balances and audit together and can retry", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("startup-rollback@example.com"));
      const organizationId = owner.actor.organization.id;
      yield* seedLegacyBilling(organizationId);
      const transaction = yield* TransactionService;
      const result = yield* transaction
        .run(
          Effect.gen(function* () {
            yield* upgradeExistingFreeSubscriptions();
            return yield* Effect.fail("injected failure");
          }),
        )
        .pipe(Effect.exit);
      expect(Exit.isFailure(result)).toBe(true);
      expect((yield* client.billing.get()).planVersion).toBe(1);
      const repository = yield* Repository;
      expect(
        (yield* repository.billing.subscription.findCurrent(organizationId))?.data,
      ).not.toHaveProperty("freeV2UpgradedAt");
      expect(
        (yield* repository.audit.organization.findForOrganization(organizationId)).filter(
          ({ event }) => event === "billing.plan_changed",
        ),
      ).toHaveLength(0);
      expect(yield* upgradeExistingFreeSubscriptions()).toEqual({ upgraded: 1, skipped: 0 });
    }),
  );

  if (process.env.NAMERA_TEST_POSTGRES_PORT) {
    it.effect("serializes concurrent startup attempts without duplicate audits", () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail("startup-concurrent@example.com"));
        const organizationId = owner.actor.organization.id;
        yield* seedLegacyBilling(organizationId);
        const results = yield* Effect.all(
          [upgradeExistingFreeSubscriptions(), upgradeExistingFreeSubscriptions()],
          { concurrency: 2 },
        );
        expect(results.reduce((sum, result) => sum + result.upgraded, 0)).toBe(1);
        const repository = yield* Repository;
        expect(
          (yield* repository.audit.organization.findForOrganization(organizationId)).filter(
            ({ event }) => event === "billing.plan_changed",
          ),
        ).toHaveLength(1);
      }),
    );
  }
});
