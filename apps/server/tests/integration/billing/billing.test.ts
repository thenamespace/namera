import { expect, layer } from "@effect/vitest";
import { DateTime, Effect } from "effect";

import {
  Application,
  freeBillingPlan,
  makeBillingMetering,
  makeBillingPeriods,
} from "@namera-ai/application";
import { Repository } from "@namera-ai/database";

import {
  createMember,
  createOrganization,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";

layer(TestServerLayer)("billing routes", (it) => {
  it.effect("initializes free billing for every organization", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("billing-owner@example.com"));

      const personalBilling = yield* client.billing.get();
      const repository = yield* Repository;
      expect(personalBilling).toMatchObject({
        organizationId: signedIn.actor.organization.id,
        plan: "free",
        planVersion: 1,
        status: "active",
        resources: [
          { key: "members", includedAmount: 5n, usedAmount: 1n, remainingAmount: 4n },
          {
            key: "software-wallets",
            includedAmount: 5n,
            usedAmount: 0n,
            remainingAmount: 5n,
          },
          { key: "hsm-wallets", includedAmount: 0n, usedAmount: 0n, remainingAmount: 0n },
          { key: "local-wallets", includedAmount: 50n, usedAmount: 0n, remainingAmount: 50n },
        ],
      });
      expect(personalBilling.meters).toEqual([
        {
          key: "execution.mainnet",
          unit: "operation",
          includedAmount: 100n,
          hardLimitAmount: 100n,
          consumedAmount: 0n,
          reservedAmount: 0n,
          remainingAmount: 100n,
        },
        {
          key: "execution.testnet",
          unit: "operation",
          includedAmount: 1_000n,
          hardLimitAmount: 1_000n,
          consumedAmount: 0n,
          reservedAmount: 0n,
          remainingAmount: 1_000n,
        },
        {
          key: "gas-sponsorship",
          unit: "micro-usd",
          includedAmount: 3_000_000n,
          hardLimitAmount: 3_000_000n,
          consumedAmount: 0n,
          reservedAmount: 0n,
          remainingAmount: 3_000_000n,
        },
        {
          key: "signature",
          unit: "operation",
          includedAmount: 10_000n,
          hardLimitAmount: 10_000n,
          consumedAmount: 0n,
          reservedAmount: 0n,
          remainingAmount: 10_000n,
        },
      ]);

      const personalPeriod = yield* repository.billing.period.findOpen(
        signedIn.actor.organization.id,
      );
      const personalOrganization = yield* repository.auth.organization.findById(
        signedIn.actor.organization.id,
      );
      expect(personalPeriod).toBeDefined();
      expect(personalOrganization).toBeDefined();
      if (!personalPeriod || !personalOrganization) {
        return yield* Effect.die("Expected initialized organization billing period");
      }
      expect(DateTime.toEpochMillis(personalPeriod.startsAt)).toBe(
        DateTime.toEpochMillis(personalOrganization.createdAt),
      );
      expect(DateTime.toEpochMillis(personalPeriod.endsAt)).toBe(
        DateTime.toEpochMillis(DateTime.add(personalOrganization.createdAt, { months: 1 })),
      );
      const balances = yield* repository.billing.meterBalance.listForPeriod(
        signedIn.actor.organization.id,
        personalPeriod.id,
      );
      expect(
        balances.map((balance) => ({
          key: balance.meterKey,
          unit: balance.unit,
          included: balance.includedAmount,
          hardLimit: balance.hardLimitAmount,
          consumed: balance.consumedAmount,
          reserved: balance.reservedAmount,
        })),
      ).toEqual([
        {
          key: "execution.mainnet",
          unit: "operation",
          included: 100n,
          hardLimit: 100n,
          consumed: 0n,
          reserved: 0n,
        },
        {
          key: "execution.testnet",
          unit: "operation",
          included: 1_000n,
          hardLimit: 1_000n,
          consumed: 0n,
          reserved: 0n,
        },
        {
          key: "gas-sponsorship",
          unit: "micro-usd",
          included: 3_000_000n,
          hardLimit: 3_000_000n,
          consumed: 0n,
          reserved: 0n,
        },
        {
          key: "signature",
          unit: "operation",
          included: 10_000n,
          hardLimit: 10_000n,
          consumed: 0n,
          reserved: 0n,
        },
      ]);

      const organization = yield* createOrganization(client, "Billing workspace");
      const organizationBilling = yield* client.billing.get();
      expect(organizationBilling.organizationId).toBe(organization.id);
      expect(organizationBilling.plan).toBe("free");

      expect(yield* repository.billing.account.findByOrganizationId(organization.id)).toBeDefined();
      expect(yield* repository.billing.subscription.findCurrent(organization.id)).toMatchObject({
        plan: "free",
        planVersion: 1,
      });
    }),
  );

  it.effect("provides persistence operations for the complete billing schema", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("billing-repositories@example.com"));
      const organizationId = signedIn.actor.organization.id;
      const repository = yield* Repository;
      const now = yield* DateTime.now;
      const subscription = yield* repository.billing.subscription.findCurrent(organizationId);
      const period = yield* repository.billing.period.findOpen(organizationId);
      expect(subscription).toBeDefined();
      expect(period).toBeDefined();
      if (!subscription || !period) {
        return yield* Effect.die("Expected initialized billing subscription and period");
      }

      const item = yield* repository.billing.subscriptionItem.insert({
        organizationId,
        subscriptionId: subscription.id,
        componentKey: "plan.base",
        billingMode: "licensed",
        provider: "stripe",
        providerSubscriptionItemId: "si_test_free",
        providerPriceId: "price_test_free",
        quantity: 1n,
      });
      expect(
        yield* repository.billing.subscriptionItem.findActive(
          organizationId,
          subscription.id,
          "plan.base",
        ),
      ).toMatchObject({ id: item.id, status: "active" });

      const reserved = yield* repository.billing.usageReservation.reserve({
        organizationId,
        periodId: period.id,
        meterKey: "execution.mainnet",
        meterVersion: freeBillingPlan.meters["execution.mainnet"].version,
        unit: "operation",
        amount: 1n,
        sourceType: "execution-submission",
        sourceId: "repository-test-execution",
        expiresAt: DateTime.add(now, { minutes: 5 }),
      });
      expect(reserved.inserted).toBe(true);

      const appended = yield* repository.billing.usageEvent.append({
        organizationId,
        periodId: period.id,
        meterKey: "execution.mainnet",
        meterVersion: freeBillingPlan.meters["execution.mainnet"].version,
        unit: "operation",
        amount: 1n,
        direction: "debit",
        sourceType: "execution-submission",
        sourceId: "repository-test-execution",
        reservationId: reserved.reservation.id,
        idempotencyKey: "billing-event:repository-test-execution",
        data: { version: 1 },
        occurredAt: now,
      });
      expect(appended.inserted).toBe(true);
      expect(
        yield* repository.billing.usageReservation.markSettled(
          organizationId,
          reserved.reservation.id,
          now,
        ),
      ).toMatchObject({ status: "settled" });

      const delivery = yield* repository.billing.usageDelivery.enqueue({
        organizationId,
        usageEventId: appended.event.id,
        provider: "stripe",
        destination: "meter_test_execution",
        providerCustomerId: "cus_test_free",
        idempotencyKey: "stripe-usage:repository-test-execution",
      });
      expect(delivery.inserted).toBe(true);
      expect(
        yield* repository.billing.usageDelivery.markDelivered(
          organizationId,
          delivery.delivery.id,
          "mue_test_execution",
          now,
        ),
      ).toMatchObject({ status: "delivered", attempts: 1 });

      const providerEvent = yield* repository.billing.providerEvent.receive({
        provider: "stripe",
        providerEventId: "evt_repository_test",
        type: "customer.subscription.updated",
        livemode: false,
        data: { version: 1 },
        providerCreatedAt: now,
      });
      expect(providerEvent.inserted).toBe(true);
      expect(
        yield* repository.billing.providerEvent.markProcessed(providerEvent.event.id, now),
      ).toMatchObject({ status: "processed", attempts: 1 });

      expect(
        yield* repository.billing.subscriptionItem.markRemoved(organizationId, item.id, now),
      ).toMatchObject({ status: "removed" });
    }),
  );

  it.effect("reserves, settles, replays, releases, and repairs metered usage", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("billing-metering@example.com"));
      const organizationId = signedIn.actor.organization.id;
      const metering = yield* makeBillingMetering;
      const repository = yield* Repository;
      const now = yield* DateTime.now;

      const reservation = yield* metering.reserve({
        organizationId,
        meterKey: "execution.mainnet",
        amount: 80n,
        sourceType: "manual-adjustment",
        sourceId: "metering-reserve",
        expiresAt: DateTime.add(now, { minutes: 5 }),
      });
      expect(
        (yield* metering.reserve({
          organizationId,
          meterKey: "execution.mainnet",
          amount: 80n,
          sourceType: "manual-adjustment",
          sourceId: "metering-reserve",
          expiresAt: DateTime.add(now, { minutes: 5 }),
        })).id,
      ).toBe(reservation.id);

      const limitError = yield* metering
        .reserve({
          organizationId,
          meterKey: "execution.mainnet",
          amount: 21n,
          sourceType: "manual-adjustment",
          sourceId: "metering-over-limit",
          expiresAt: DateTime.add(now, { minutes: 5 }),
        })
        .pipe(Effect.flip);
      expect(limitError).toMatchObject({
        _tag: "BillingError",
        code: "LIMIT_EXCEEDED",
        limit: "execution.mainnet",
      });

      const settled = yield* metering.settle({
        organizationId,
        reservationId: reservation.id,
        amount: 60n,
        data: { version: 1, test: true },
      });
      expect(settled).toBeDefined();
      expect(
        (yield* metering.settle({
          organizationId,
          reservationId: reservation.id,
          amount: 60n,
        }))?.id,
      ).toBe(settled?.id);

      const releasedReservation = yield* metering.reserve({
        organizationId,
        meterKey: "execution.mainnet",
        amount: 10n,
        sourceType: "manual-adjustment",
        sourceId: "metering-release",
        expiresAt: DateTime.add(now, { minutes: 5 }),
      });
      expect(
        yield* metering.release({ organizationId, reservationId: releasedReservation.id }),
      ).toMatchObject({ status: "released" });
      expect(
        yield* metering.release({ organizationId, reservationId: releasedReservation.id }),
      ).toMatchObject({ status: "released" });

      const period = yield* repository.billing.period.findOpen(organizationId);
      if (period === undefined) return yield* Effect.die("Expected billing period");
      expect(
        yield* repository.billing.meterBalance.find(organizationId, period.id, "execution.mainnet"),
      ).toMatchObject({ consumedAmount: 60n, reservedAmount: 0n });

      yield* repository.billing.meterBalance.replaceProjection(
        organizationId,
        period.id,
        "execution.mainnet",
        0n,
        0n,
      );
      const application = yield* Application;
      expect(yield* application.billing.reconcile()).toMatchObject({ repaired: 1 });
      expect(
        yield* repository.billing.meterBalance.find(organizationId, period.id, "execution.mainnet"),
      ).toMatchObject({ consumedAmount: 60n, reservedAmount: 0n });
      expect(
        (yield* client.billing.get()).meters.find((meter) => meter.key === "execution.mainnet"),
      ).toMatchObject({ consumedAmount: 60n, reservedAmount: 0n, remainingAmount: 40n });
    }),
  );

  it.effect("rolls anniversary periods forward without calendar-month resets", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("billing-anniversary@example.com"));
      const organizationId = signedIn.actor.organization.id;
      const repository = yield* Repository;
      const periods = yield* makeBillingPeriods;
      const initial = yield* repository.billing.period.findOpen(organizationId);
      if (initial === undefined) return yield* Effect.die("Expected initial billing period");

      const future = DateTime.add(DateTime.add(initial.startsAt, { months: 2 }), { seconds: 1 });
      const current = yield* periods.current(organizationId, future);
      expect(DateTime.toEpochMillis(current.startsAt)).toBe(
        DateTime.toEpochMillis(DateTime.add(initial.startsAt, { months: 2 })),
      );
      expect(DateTime.toEpochMillis(current.endsAt)).toBe(
        DateTime.toEpochMillis(DateTime.add(initial.startsAt, { months: 3 })),
      );
      expect(current.status).toBe("open");

      const subscription = yield* repository.billing.subscription.findCurrent(organizationId);
      if (subscription === undefined) return yield* Effect.die("Expected billing subscription");
      const history = yield* repository.billing.period.listForSubscription(
        organizationId,
        subscription.id,
      );
      expect(history).toHaveLength(3);
      expect(history.filter((period) => period.status === "open")).toHaveLength(1);
      expect(
        yield* repository.billing.meterBalance.listForPeriod(organizationId, current.id),
      ).toHaveLength(Object.keys(freeBillingPlan.meters).length);
    }),
  );

  it.effect("recovers expired reservations without leaking meter capacity", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("billing-recovery@example.com"));
      const organizationId = signedIn.actor.organization.id;
      const metering = yield* makeBillingMetering;
      const repository = yield* Repository;
      const now = yield* DateTime.now;
      const reservation = yield* metering.reserve({
        organizationId,
        meterKey: "signature",
        amount: 25n,
        sourceType: "manual-adjustment",
        sourceId: "expired-reservation",
        expiresAt: DateTime.subtract(now, { seconds: 1 }),
      });

      const application = yield* Application;
      expect(yield* application.billing.reconcile()).toMatchObject({ recovered: 1 });
      expect(
        yield* repository.billing.usageReservation.findById(organizationId, reservation.id),
      ).toMatchObject({ status: "expired" });
      const period = yield* repository.billing.period.findOpen(organizationId);
      if (period === undefined) return yield* Effect.die("Expected billing period");
      expect(
        yield* repository.billing.meterBalance.find(organizationId, period.id, "signature"),
      ).toMatchObject({ consumedAmount: 0n, reservedAmount: 0n });
    }),
  );

  it.effect("requires billing read permission", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("billing-permission-owner@example.com"));
      const admin = yield* createMember(
        client,
        testEmail("billing-permission-admin@example.com"),
        "admin",
      );
      yield* setAuthToken(admin.ownerToken);
      const member = yield* createMember(
        client,
        testEmail("billing-permission-member@example.com"),
      );

      yield* setAuthToken(admin.memberToken);
      expect((yield* client.billing.get()).organizationId).toBe(admin.owner.organization.id);

      yield* setAuthToken(member.memberToken);
      const error = yield* client.billing.get().pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "Forbidden" });
    }),
  );
});
