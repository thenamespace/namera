import { DateTime, Duration, Effect, Layer, Metric } from "effect";

import { Application } from "@namera-ai/application";
import { workerLastSuccess, workerPollResults } from "@namera-ai/telemetry";

export const SessionKeyWorkerLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const app = yield* Application;
    for (const { reconcile, worker } of [
      { reconcile: app.sessionKey.reconcileOperations, worker: "session_key" },
      { reconcile: app.sessionKey.reconcileDeactivations, worker: "signing_key_deactivation" },
    ]) {
      yield* Effect.gen(function* () {
        while (true) {
          yield* reconcile().pipe(
            Effect.tap(() =>
              Effect.gen(function* () {
                yield* Metric.update(
                  Metric.withAttributes(workerPollResults, {
                    worker,
                    result: "success",
                  }),
                  1,
                );
                yield* Metric.update(
                  Metric.withAttributes(workerLastSuccess, { worker }),
                  DateTime.toEpochMillis(yield* DateTime.now) / 1000,
                );
              }),
            ),
            Effect.catchCause(() =>
              Effect.logError("session_key.worker.failed").pipe(
                Effect.annotateLogs({ worker }),
                Effect.andThen(
                  Metric.update(
                    Metric.withAttributes(workerPollResults, {
                      worker,
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
        Effect.onInterrupt(() =>
          Effect.logInfo("session_key.worker.stopped").pipe(Effect.annotateLogs({ worker })),
        ),
        Effect.forkScoped,
      );
    }
  }),
);
