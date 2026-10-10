import { DateTime, Effect, Schema } from "effect";

import type { BillingPeriod } from "@namera-ai/protocol/model";
import { BillingSubscription } from "@namera-ai/protocol/model";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { type DatabaseService, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { billingMeterBalance, billingPeriod, billingSubscription } from "#/schema/index";

type MeterLimit = {
  readonly key: typeof billingMeterBalance.$inferSelect.meterKey;
  readonly includedAmount: bigint;
  readonly hardLimitAmount: bigint;
};

export const makeFreeV2UpgradeMethods = (database: DatabaseService) => ({
  listFreeV1: Effect.fn("database.billingSubscriptionRepository.listFreeV1")(function* () {
    const db = yield* transactionOrDatabase(database);
    const rows = yield* db
      .select()
      .from(billingSubscription)
      .where(
        and(
          eq(billingSubscription.plan, "free"),
          eq(billingSubscription.planVersion, 1),
          inArray(billingSubscription.status, ["trialing", "active", "past_due"]),
        ),
      )
      .orderBy(asc(billingSubscription.organizationId));
    return Schema.decodeUnknownSync(Schema.Array(BillingSubscription))(rows);
  }, mapRepositoryError),

  applyFreeV2ToCurrentPeriod: Effect.fn(
    "database.billingSubscriptionRepository.applyFreeV2ToCurrentPeriod",
  )(function* (period: BillingPeriod, meters: ReadonlyArray<MeterLimit>, at: DateTime.Utc) {
    const db = yield* transactionOrDatabase(database);
    for (const meter of meters) {
      const rows = yield* db
        .update(billingMeterBalance)
        .set({
          includedAmount: meter.includedAmount,
          // Existing reservations must remain settleable even above the new allowance.
          hardLimitAmount: sql`greatest(${meter.hardLimitAmount}, ${billingMeterBalance.consumedAmount} + ${billingMeterBalance.reservedAmount})`,
        })
        .where(
          and(
            eq(billingMeterBalance.organizationId, period.organizationId),
            eq(billingMeterBalance.periodId, period.id),
            eq(billingMeterBalance.meterKey, meter.key),
          ),
        )
        .returning({ key: billingMeterBalance.meterKey });
      if (rows.length !== 1) return yield* Effect.die("Free v2 upgrade meter is missing");
    }
    const periods = yield* db
      .update(billingPeriod)
      .set({ planVersion: 2 })
      .where(
        and(
          eq(billingPeriod.id, period.id),
          eq(billingPeriod.organizationId, period.organizationId),
          eq(billingPeriod.status, "open"),
          eq(billingPeriod.planVersion, 1),
        ),
      )
      .returning({ id: billingPeriod.id });
    if (periods.length !== 1) return yield* Effect.die("Free v2 upgrade period changed");
    const subscriptions = yield* db
      .update(billingSubscription)
      .set({
        planVersion: 2,
        data: sql`${billingSubscription.data} || jsonb_build_object('freeV2UpgradedAt', ${DateTime.formatIso(at)}::text)`,
      })
      .where(
        and(
          eq(billingSubscription.id, period.subscriptionId),
          eq(billingSubscription.organizationId, period.organizationId),
          eq(billingSubscription.planVersion, 1),
        ),
      )
      .returning({ id: billingSubscription.id });
    if (subscriptions.length !== 1)
      return yield* Effect.die("Free v2 upgrade subscription changed");
  }, mapRepositoryError),
});
