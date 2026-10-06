import { DateTime, Duration, Effect, Layer, Metric } from "effect";

import { Application } from "@namera-ai/application";
import { workerLastSuccess, workerPollResults } from "@namera-ai/telemetry";

export const SessionKeyWorkerLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const app = yield* Application;
    yield* Effect.gen(function* () {
      while (true) {
        yield* app.sessionKey.reconcileOperations().pipe(
          Effect.tap(() =>
            Effect.gen(function* () {
              yield* Metric.update(
                Metric.withAttributes(workerPollResults, {
                  worker: "session_key",
                  result: "success",
                }),
                1,
              );
              yield* Metric.update(
                Metric.withAttributes(workerLastSuccess, { worker: "session_key" }),
                DateTime.toEpochMillis(yield* DateTime.now) / 1000,
              );
            }),
          ),
          Effect.catchCause(() =>
            Effect.logError("session_key.worker.failed").pipe(
              Effect.andThen(
                Metric.update(
                  Metric.withAttributes(workerPollResults, {
                    worker: "session_key",
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
      Effect.onInterrupt(() => Effect.logInfo("session_key.worker.stopped")),
      Effect.forkScoped,
    );
  }),
);
