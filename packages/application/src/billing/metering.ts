import { DateTime, Effect, Metric, type Schema } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import {
  BillingLimitExceededError,
  type BillingUsageReservationId,
  type OrganizationId,
} from "@namera-ai/protocol";
import type {
  BillingMeterKey,
  BillingUsageReservation,
  BillingUsageSourceType,
} from "@namera-ai/protocol/model";
import { billingMeterTransitions } from "@namera-ai/telemetry";

import { freeBillingPlan } from "./data.js";
import { makeBillingPeriods } from "./periods.js";

export interface ReserveUsageInput {
  readonly organizationId: OrganizationId;
  readonly meterKey: BillingMeterKey;
  readonly amount: bigint;
  readonly sourceType: BillingUsageSourceType;
  readonly sourceId: string;
  readonly expiresAt: DateTime.Utc;
}

export interface SettleUsageInput {
  readonly organizationId: OrganizationId;
  readonly reservationId: BillingUsageReservationId;
  readonly amount: bigint;
  readonly data?: typeof Schema.Json.Type;
}

const assertSameReservation = (reservation: BillingUsageReservation, input: ReserveUsageInput) => {
  if (
    reservation.organizationId !== input.organizationId ||
    reservation.meterKey !== input.meterKey ||
    reservation.sourceType !== input.sourceType ||
    reservation.sourceId !== input.sourceId ||
    reservation.amount !== input.amount
  ) {
    throw new Error("Billing reservation idempotency conflict");
  }
};

export const makeBillingMetering = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const periods = yield* makeBillingPeriods;

  const reserve = Effect.fn("application.billing.metering.reserve")(function* (
    input: ReserveUsageInput,
  ) {
    if (input.amount <= 0n) return yield* Effect.die("Billing reservation amount must be positive");

    return yield* transaction.run(
      Effect.gen(function* () {
        const now = yield* DateTime.now;
        const period = yield* periods.current(input.organizationId, now);
        const definition = freeBillingPlan.meters[input.meterKey];
        const result = yield* repository.billing.usageReservation.reserve({
          organizationId: input.organizationId,
          periodId: period.id,
          meterKey: input.meterKey,
          meterVersion: definition.version,
          unit: definition.unit,
          amount: input.amount,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          expiresAt: input.expiresAt,
        });
        assertSameReservation(result.reservation, input);
        if (!result.inserted) {
          yield* Metric.update(
            Metric.withAttributes(billingMeterTransitions, {
              meter: input.meterKey,
              outcome: "reused",
            }),
            1,
          );
          return result.reservation;
        }

        const balance = yield* repository.billing.meterBalance.addReserved(
          input.organizationId,
          period.id,
          input.meterKey,
          input.amount,
        );
        if (balance === undefined) {
          yield* Metric.update(
            Metric.withAttributes(billingMeterTransitions, {
              meter: input.meterKey,
              outcome: "denied",
            }),
            1,
          );
          return yield* new BillingLimitExceededError({
            code: "LIMIT_EXCEEDED",
            limit: input.meterKey,
          });
        }
        yield* Metric.update(
          Metric.withAttributes(billingMeterTransitions, {
            meter: input.meterKey,
            outcome: "reserved",
          }),
          1,
        );
        return result.reservation;
      }),
    );
  });

  const release = Effect.fn("application.billing.metering.release")(function* (input: {
    readonly organizationId: OrganizationId;
    readonly reservationId: BillingUsageReservationId;
    readonly status?: "released" | "expired";
  }) {
    return yield* transaction.run(
      Effect.gen(function* () {
        const reservation = yield* repository.billing.usageReservation.findForUpdate(
          input.organizationId,
          input.reservationId,
        );
        if (reservation === undefined || reservation.status !== "active") return reservation;

        const balance = yield* repository.billing.meterBalance.releaseReserved(
          input.organizationId,
          reservation.periodId,
          reservation.meterKey,
          reservation.amount,
        );
        if (balance === undefined) return yield* Effect.die("Billing balance release failed");
        const released = yield* repository.billing.usageReservation.markReleased(
          input.organizationId,
          reservation.id,
          input.status ?? "released",
          yield* DateTime.now,
        );
        yield* Metric.update(
          Metric.withAttributes(billingMeterTransitions, {
            meter: reservation.meterKey,
            outcome: input.status === "expired" ? "expired" : "released",
          }),
          1,
        );
        return released;
      }),
    );
  });

  const settle = Effect.fn("application.billing.metering.settle")(function* (
    input: SettleUsageInput,
  ) {
    if (input.amount < 0n) return yield* Effect.die("Billing settlement amount cannot be negative");
    if (input.amount === 0n) {
      yield* release(input);
      return undefined;
    }

    return yield* transaction.run(
      Effect.gen(function* () {
        const reservation = yield* repository.billing.usageReservation.findForUpdate(
          input.organizationId,
          input.reservationId,
        );
        if (reservation === undefined) return yield* Effect.die("Billing reservation is missing");
        const idempotencyKey = `billing:settle:${reservation.id}`;
        if (reservation.status === "settled") {
          return yield* repository.billing.usageEvent.findByIdempotencyKey(
            input.organizationId,
            idempotencyKey,
          );
        }
        if (reservation.status !== "active") return undefined;
        if (input.amount > reservation.amount) {
          return yield* Effect.die("Billing settlement exceeds its reservation");
        }

        const balance = yield* repository.billing.meterBalance.settleReserved(
          input.organizationId,
          reservation.periodId,
          reservation.meterKey,
          reservation.amount,
          input.amount,
        );
        if (balance === undefined) return yield* Effect.die("Billing balance settlement failed");

        const now = yield* DateTime.now;
        const result = yield* repository.billing.usageEvent.append({
          organizationId: input.organizationId,
          periodId: reservation.periodId,
          meterKey: reservation.meterKey,
          meterVersion: reservation.meterVersion,
          unit: reservation.unit,
          amount: input.amount,
          direction: "debit",
          sourceType: reservation.sourceType,
          sourceId: reservation.sourceId,
          reservationId: reservation.id,
          idempotencyKey,
          data: input.data ?? {},
          reversesUsageEventId: null,
          occurredAt: now,
        });
        const updated = yield* repository.billing.usageReservation.markSettled(
          input.organizationId,
          reservation.id,
          now,
        );
        if (updated === undefined)
          return yield* Effect.die("Billing reservation settlement failed");
        yield* Metric.update(
          Metric.withAttributes(billingMeterTransitions, {
            meter: reservation.meterKey,
            outcome: "settled",
          }),
          1,
        );
        return result.event;
      }),
    );
  });

  return { reserve, release, settle } as const;
});
