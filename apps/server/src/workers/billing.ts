import { Duration, Effect, Layer } from "effect";

import { Application } from "@namera-ai/application";

const workerPollInterval = Duration.minutes(1);

export const BillingWorkerLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const app = yield* Application;

    yield* Effect.gen(function* () {
      while (true) {
        yield* app.billing.reconcile().pipe(
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
          Effect.catch((error) => Effect.logError("billing.worker.failed", error)),
        );
        yield* Effect.sleep(workerPollInterval);
      }
    }).pipe(
      Effect.onInterrupt(() => Effect.logInfo("billing.worker.stopped")),
      Effect.forkScoped,
    );
  }),
);
