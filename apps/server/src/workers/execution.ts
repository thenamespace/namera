import { DateTime, Duration, Effect, Layer, Metric } from "effect";

import { Application } from "@namera-ai/application";
import { workerLastSuccess, workerPollResults } from "@namera-ai/telemetry";

const workerPollInterval = Duration.seconds(5);

export const ExecutionWorkerLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const app = yield* Application;

    yield* Effect.gen(function* () {
      while (true) {
        const processed = yield* app.execution.reconcile().pipe(
          Effect.tap(() =>
            Effect.gen(function* () {
              yield* Metric.update(
                Metric.withAttributes(workerPollResults, {
                  worker: "execution",
                  result: "success",
                }),
                1,
              );
              yield* Metric.update(
                Metric.withAttributes(workerLastSuccess, { worker: "execution" }),
                DateTime.toEpochMillis(yield* DateTime.now) / 1000,
              );
            }),
          ),
          Effect.catchCause(() =>
            Effect.logError("execution.worker.failed").pipe(
              Effect.andThen(
                Metric.update(
                  Metric.withAttributes(workerPollResults, {
                    worker: "execution",
                    result: "failure",
                  }),
                  1,
                ),
              ),
              Effect.as(0),
            ),
          ),
        );
        if (processed === 0) yield* Effect.sleep(workerPollInterval);
      }
    }).pipe(
      Effect.onInterrupt(() => Effect.logInfo("execution.worker.stopped")),
      Effect.forkScoped,
    );
  }),
);
