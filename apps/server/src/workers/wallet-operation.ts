import { Cause, DateTime, Duration, Effect, Layer, Metric, Random } from "effect";

import { Application } from "@namera-ai/application";
import { workerLastSuccess, workerPollResults } from "@namera-ai/telemetry";

export const WalletOperationWorkerLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const app = yield* Application;
    yield* Effect.gen(function* () {
      let failures = 0;
      while (true) {
        const succeeded = yield* app.wallet.transactions.reconcile().pipe(
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
          Effect.as(true),
          Effect.catchCause((cause) => {
            if (Cause.hasInterruptsOnly(cause)) return Effect.failCause(cause);
            return Effect.logError("wallet_operation.worker.failed").pipe(
              Effect.andThen(
                Metric.update(
                  Metric.withAttributes(workerPollResults, {
                    worker: "wallet_operation",
                    result: "failure",
                  }),
                  1,
                ),
              ),
              Effect.as(false),
            );
          }),
        );
        failures = succeeded ? 0 : Math.min(failures + 1, 5);
        // Always yield between batches, including continuously retrying operations.
        const delay = succeeded
          ? 5
          : Math.min(5 * 2 ** failures, 60) * (0.8 + (yield* Random.next) * 0.4);
        yield* Effect.sleep(Duration.seconds(delay));
      }
    }).pipe(
      Effect.onInterrupt(() => Effect.logInfo("wallet_operation.worker.stopped")),
      Effect.forkScoped,
    );
  }),
);
