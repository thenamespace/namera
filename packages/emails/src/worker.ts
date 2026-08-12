import { Effect, Layer } from "effect";

import { emailPolicy } from "./data.js";
import { EmailJobs } from "./jobs.js";

export const EmailWorkerLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const jobs = yield* EmailJobs;

    yield* Effect.gen(function* () {
      while (true) {
        const processed = yield* jobs.processOnce.pipe(
          Effect.catch((error) => Effect.logError("email.worker.failed", error).pipe(Effect.as(0))),
        );
        if (processed === 0) {
          yield* Effect.sleep(emailPolicy.workerPollInterval);
        }
      }
    }).pipe(
      Effect.onInterrupt(() => Effect.logInfo("email.worker.stopped")),
      Effect.forkScoped,
    );
  }),
);
