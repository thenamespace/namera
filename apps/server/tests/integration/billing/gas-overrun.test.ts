import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Exit, Result } from "effect";
import { TestClock } from "effect/testing";

import { Application, makeBillingMetering } from "@namera-ai/application";
import { Database, Repository } from "@namera-ai/database";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";

const setup = Effect.gen(function* () {
  yield* resetTestState();
  const client = yield* makeTestApiClient;
  const { actor } = yield* signIn(
    client,
    testEmail(`gas-overrun-${crypto.randomUUID()}@example.com`),
  );
  const organizationId = actor.organization.id;
  const metering = yield* makeBillingMetering;
  const repository = yield* Repository;
  const app = yield* Application;
  const expiresAt = DateTime.add(yield* DateTime.now, { days: 60 });
  const reserve = (
    sourceId: string,
    amount: bigint,
    meterKey: "gas-sponsorship" | "execution.mainnet" = "gas-sponsorship",
  ) =>
    metering.reserve({
      organizationId,
      sourceId,
      sourceType: "manual-adjustment",
      amount,
      meterKey,
      expiresAt,
    });
  return { client, organizationId, metering, repository, app, reserve };
});

layer(TestServerLayer)("sponsored gas actual-cost accounting", (it) => {
  it.effect("does not relax reservation or hard-limit guards for non-gas meters", () =>
    Effect.gen(function* () {
      const { organizationId, metering, repository, reserve } = yield* setup;
      const operation = yield* reserve("execution", 1n, "execution.mainnet");
      const settled = yield* metering
        .settle({ organizationId, reservationId: operation.id, amount: 2n })
        .pipe(Effect.exit);
      expect(Exit.isFailure(settled)).toBe(true);
      const balance = yield* repository.billing.meterBalance.find(
        organizationId,
        operation.periodId,
        "execution.mainnet",
      );
      if (!balance || balance.hardLimitAmount === null)
        return yield* Effect.die("Missing execution balance");
      expect(balance).toMatchObject({ consumedAmount: 0n, reservedAmount: 1n });
      expect(
        yield* repository.billing.meterBalance.settleReserved(
          organizationId,
          operation.periodId,
          "execution.mainnet",
          1n,
          balance.hardLimitAmount + 1n,
        ),
      ).toBeUndefined();
      expect(
        yield* repository.billing.meterBalance.replaceProjection(
          organizationId,
          operation.periodId,
          "execution.mainnet",
          balance.hardLimitAmount + 1n,
          0n,
        ),
      ).toBeUndefined();
    }),
  );
  it.effect(
    "records $3.05 against a $3 allowance, blocks sponsorship, and permits self-funded usage",
    () =>
      Effect.gen(function* () {
        const { client, organizationId, metering, repository, app, reserve } = yield* setup;
        const previous = yield* reserve("previous-cost", 2_800_000n);
        yield* metering.settle({ organizationId, reservationId: previous.id, amount: 2_800_000n });
        const operation = yield* reserve("estimated-cost", 150_000n);
        const other = yield* reserve("other-in-flight", 40_000n);
        const settle = metering.settle({
          organizationId,
          reservationId: operation.id,
          amount: 250_000n,
        });
        yield* settle;
        yield* settle;
        yield* metering.release({ organizationId, reservationId: operation.id });
        expect(
          yield* repository.billing.meterBalance.find(
            organizationId,
            operation.periodId,
            "gas-sponsorship",
          ),
        ).toMatchObject({
          consumedAmount: 3_050_000n,
          reservedAmount: 40_000n,
          hardLimitAmount: 3_000_000n,
        });
        expect(
          (yield* repository.billing.usageReservation.findById(organizationId, operation.id))
            ?.status,
        ).toBe("settled");
        const denied = yield* reserve("no-more-sponsorship", 1n).pipe(Effect.result);
        expect(Result.isFailure(denied)).toBe(true);
        if (Result.isFailure(denied))
          expect(denied.failure).toMatchObject({
            code: "LIMIT_EXCEEDED",
            limit: "gas-sponsorship",
          });
        yield* reserve("self-funded-execution", 1n, "execution.mainnet");
        yield* metering.release({ organizationId, reservationId: other.id });
        expect(
          (yield* client.billing.get()).meters.find((meter) => meter.key === "gas-sponsorship"),
        ).toMatchObject({
          consumedAmount: 3_050_000n,
          reservedAmount: 0n,
          remainingAmount: 0n,
          hardLimitAmount: 3_000_000n,
        });
        expect(
          yield* repository.billing.usageEvent.getNetAmount(
            organizationId,
            operation.periodId,
            "gas-sponsorship",
          ),
        ).toBe(3_050_000n);
        // Repair must preserve actual expenses above the admission ceiling.
        yield* repository.billing.meterBalance.replaceProjection(
          organizationId,
          operation.periodId,
          "gas-sponsorship",
          0n,
          0n,
        );
        expect(yield* app.billing.reconcile()).toMatchObject({ repaired: 1 });
        expect(
          (yield* client.billing.get()).meters.find((meter) => meter.key === "gas-sponsorship"),
        ).toMatchObject({ consumedAmount: 3_050_000n, remainingAmount: 0n });
        expect(yield* (yield* Database).query.billingUsageDelivery.findMany()).toHaveLength(0);
      }),
  );

  it.effect(
    "settles late overruns against the original period without consuming renewed allowance",
    () =>
      Effect.gen(function* () {
        const { app, organizationId, metering, repository, reserve } = yield* setup;
        const operation = yield* reserve("old-period", 150_000n);
        const period = yield* repository.billing.period.findOpen(organizationId);
        if (!period) return yield* Effect.die("Missing period");
        yield* TestClock.setTime(DateTime.toEpochMillis(period.endsAt) + 1);
        const renewed = yield* app.billing.get(organizationId);
        expect(renewed.period.id).not.toBe(operation.periodId);
        yield* metering.settle({ organizationId, reservationId: operation.id, amount: 3_050_000n });
        expect(
          yield* repository.billing.meterBalance.find(
            organizationId,
            operation.periodId,
            "gas-sponsorship",
          ),
        ).toMatchObject({ consumedAmount: 3_050_000n, reservedAmount: 0n });
        expect(
          (yield* app.billing.get(organizationId)).meters.find(
            (meter) => meter.key === "gas-sponsorship",
          ),
        ).toMatchObject({ consumedAmount: 0n, remainingAmount: 3_000_000n });
        yield* reserve("new-period", 150_000n);
      }),
  );
});
