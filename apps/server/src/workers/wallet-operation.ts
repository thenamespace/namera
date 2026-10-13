import { DateTime, Duration, Effect, Layer, Metric } from "effect";

import { Application } from "@namera-ai/application";
import { workerLastSuccess, workerPollResults } from "@namera-ai/telemetry";

export const WalletOperationWorkerLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const app = yield* Application;
    yield* Effect.gen(function* () {
      while (true) {
        yield* app.wallet.transactions.reconcile().pipe(
          Effect.tap(() =>
            Effect.gen(function* () {
              yield* Metric.update(
                Metric.withAttributes(workerPollResults, {
                  worker: "wallet_operation",
                  result: "success",
                }),
                1,
              );
              yield* Metric.update(
                Metric.withAttributes(workerLastSuccess, { worker: "wallet_operation" }),
                DateTime.toEpochMillis(yield* DateTime.now) / 1000,
              );
            }),
          ),
          Effect.catchCause(() =>
            Effect.logError("wallet_operation.worker.failed").pipe(
              Effect.andThen(
                Metric.update(
                  Metric.withAttributes(workerPollResults, {
                    worker: "wallet_operation",
                    result: "failure",
                  }),
                  1,
                ),
              ),
            ),
          ),
        );
        // Always yield between batches, including continuously retrying operations.
        yield* Effect.sleep(Duration.seconds(5));
      }
    }).pipe(
      Effect.onInterrupt(() => Effect.logInfo("wallet_operation.worker.stopped")),
      Effect.forkScoped,
    );
  }),
);
