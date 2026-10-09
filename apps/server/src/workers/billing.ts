import { DateTime, Duration, Effect, Layer, Metric } from "effect";

import { Application } from "@namera-ai/application";
import { workerLastSuccess, workerPollResults } from "@namera-ai/telemetry";

const workerPollInterval = Duration.seconds(10);

export const BillingWorkerLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const app = yield* Application;

    yield* Effect.gen(function* () {
      let nextMaintenanceAt = 0;
      while (true) {
        const now = DateTime.toEpochMillis(yield* DateTime.now);
        const maintenanceDue = now >= nextMaintenanceAt;
        if (maintenanceDue) nextMaintenanceAt = now + 60_000;
        const reconcile = maintenanceDue
          ? app.billing.reconcile()
          : app.billing
              .reconcileSponsorships()
              .pipe(Effect.map((recovered) => ({ rolledOver: 0, recovered, repaired: 0 })));
        yield* reconcile.pipe(
          Effect.tap(() =>
            Effect.gen(function* () {
              yield* Metric.update(
                Metric.withAttributes(workerPollResults, { worker: "billing", result: "success" }),
                1,
              );
              yield* Metric.update(
                Metric.withAttributes(workerLastSuccess, { worker: "billing" }),
                DateTime.toEpochMillis(yield* DateTime.now) / 1000,
              );
            }),
          ),
          Effect.tap((result) =>
            result.rolledOver + result.recovered + result.repaired === 0
              ? Effect.void
              : Effect.logInfo("billing.worker.completed").pipe(
                  Effect.annotateLogs({
                    rolled_over: result.rolledOver,
                    recovered: result.recovered,
                    repaired: result.repaired,
                  }),
                ),
          ),
          Effect.catchCause(() =>
            Effect.logError("billing.worker.failed").pipe(
              Effect.andThen(
                Metric.update(
                  Metric.withAttributes(workerPollResults, {
                    worker: "billing",
                    result: "failure",
                  }),
                  1,
                ),
              ),
            ),
          ),
        );
        yield* Effect.sleep(workerPollInterval);
      }
    }).pipe(
      Effect.onInterrupt(() => Effect.logInfo("billing.worker.stopped")),
      Effect.forkScoped,
    );
  }),
);
