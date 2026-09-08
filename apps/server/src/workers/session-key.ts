import { Duration, Effect, Layer } from "effect";

import { Application } from "@namera-ai/application";

export const SessionKeyWorkerLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const app = yield* Application;
    yield* Effect.gen(function* () {
      while (true) {
        yield* app.sessionKey
          .reconcileOperations()
          .pipe(Effect.catchCause(() => Effect.logError("session_key.worker.failed")));
        // Always yield between batches, including continuously retrying operations.
        yield* Effect.sleep(Duration.seconds(5));
      }
    }).pipe(
      Effect.onInterrupt(() => Effect.logInfo("session_key.worker.stopped")),
      Effect.forkScoped,
    );
  }),
);
