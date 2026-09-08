import { describe, expect, layer } from "@effect/vitest";
import { DateTime, Effect, Result } from "effect";

import { freeBillingPlan, makeBillingMetering, makeBillingPeriods } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";

describe.skipIf(process.env.NAMERA_TEST_POSTGRES_PORT === undefined)(
  "PostgreSQL billing concurrency",
  () => {
    layer(TestServerLayer)((it) => {
      it.effect("serializes competing admissions at each Free meter's hard limit", () =>
        Effect.gen(function* () {
          yield* resetTestState();
          const client = yield* makeTestApiClient;
          const { actor } = yield* signIn(client, testEmail("concurrent-meters@example.com"));
          const organizationId = actor.organization.id;
          const metering = yield* makeBillingMetering;
          const expiresAt = DateTime.add(yield* DateTime.now, { minutes: 5 });
          const repository = yield* Repository;

          for (const definition of Object.values(freeBillingPlan.meters)) {
            const outcomes = yield* Effect.all(
              Array.from({ length: 8 }, (_, index) =>
                metering
                  .reserve({
                    organizationId,
                    meterKey: definition.key,
                    amount: definition.hardLimitAmount / 4n,
                    sourceType: "manual-adjustment",
                    sourceId: `${definition.key}:${index}`,
                    expiresAt,
                  })
                  .pipe(Effect.result),
              ),
              { concurrency: 8 },
            );
            expect(outcomes.filter(Result.isSuccess)).toHaveLength(4);
            const failures = outcomes.filter(Result.isFailure);
            expect(failures).toHaveLength(4);
            for (const failure of failures)
              expect(failure.failure).toMatchObject({
                code: "LIMIT_EXCEEDED",
                limit: definition.key,
              });
            const period = yield* repository.billing.period.findOpen(organizationId);
            if (period === undefined) return yield* Effect.die("Expected billing period");
            expect(
              yield* repository.billing.meterBalance.find(
                organizationId,
                period.id,
                definition.key,
              ),
            ).toMatchObject({
              consumedAmount: 0n,
              reservedAmount: definition.hardLimitAmount,
            });
          }
        }),
      );

      it.effect("deduplicates concurrent reservation and settlement retries", () =>
        Effect.gen(function* () {
          yield* resetTestState();
          const client = yield* makeTestApiClient;
          const { actor } = yield* signIn(client, testEmail("concurrent-settlement@example.com"));
          const organizationId = actor.organization.id;
          const metering = yield* makeBillingMetering;
          const repository = yield* Repository;
          const input = {
            organizationId,
            meterKey: "execution.mainnet" as const,
            amount: 20n,
            sourceType: "manual-adjustment" as const,
            sourceId: "same-operation",
            expiresAt: DateTime.add(yield* DateTime.now, { minutes: 5 }),
          };
          const reservations = yield* Effect.all(
            Array.from({ length: 8 }, () => metering.reserve(input)),
            { concurrency: 8 },
          );
          expect(new Set(reservations.map((reservation) => reservation.id)).size).toBe(1);
          const reservation = reservations[0];
          if (reservation === undefined) return yield* Effect.die("Expected reservation");
          const settled = yield* Effect.all(
            Array.from({ length: 8 }, () =>
              metering.settle({ organizationId, reservationId: reservation.id, amount: 12n }),
            ),
            { concurrency: 8 },
          );
          expect(settled.every((event) => event !== undefined)).toBe(true);
          expect(new Set(settled.map((event) => event?.id)).size).toBe(1);
          yield* Effect.all(
            Array.from({ length: 8 }, () =>
              metering.release({ organizationId, reservationId: reservation.id }),
            ),
            { concurrency: 8 },
          );
          expect(
            yield* repository.billing.meterBalance.find(
              organizationId,
              reservation.periodId,
              "execution.mainnet",
            ),
          ).toMatchObject({ consumedAmount: 12n, reservedAmount: 0n });
          expect(
            yield* repository.billing.usageEvent.listForMeter(
              organizationId,
              reservation.periodId,
              "execution.mainnet",
            ),
          ).toHaveLength(1);
        }),
      );

      it.effect(
        "creates one anniversary period and one set of balances under concurrent rollover",
        () =>
          Effect.gen(function* () {
            yield* resetTestState();
            const client = yield* makeTestApiClient;
            const { actor } = yield* signIn(client, testEmail("concurrent-rollover@example.com"));
            const organizationId = actor.organization.id;
            const periods = yield* makeBillingPeriods;
            const repository = yield* Repository;
            const initial = yield* repository.billing.period.findOpen(organizationId);
            if (initial === undefined) return yield* Effect.die("Expected initial period");
            const next = DateTime.add(initial.endsAt, { seconds: 1 });
            const results = yield* Effect.all(
              Array.from({ length: 8 }, () => periods.current(organizationId, next)),
              { concurrency: 8 },
            );
            expect(new Set(results.map((period) => period.id)).size).toBe(1);
            const current = yield* repository.billing.period.findOpen(organizationId);
            if (current === undefined) return yield* Effect.die("Expected open period");
            expect(current.id).not.toBe(initial.id);
            expect(
              yield* repository.billing.period.listForSubscription(
                organizationId,
                current.subscriptionId,
              ),
            ).toHaveLength(2);
            expect(
              yield* repository.billing.meterBalance.listForPeriod(organizationId, current.id),
            ).toHaveLength(4);
          }),
      );
    });
  },
);
