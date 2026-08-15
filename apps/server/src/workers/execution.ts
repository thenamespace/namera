import { Duration, Effect, Layer } from "effect";

import { Application } from "@namera-ai/application";

const workerPollInterval = Duration.seconds(2);

export const ExecutionWorkerLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const app = yield* Application;

    yield* Effect.gen(function* () {
      while (true) {
        const processed = yield* app.execution
          .reconcile()
          .pipe(
            Effect.catch((error) =>
              Effect.logError("execution.worker.failed", error).pipe(Effect.as(0)),
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
