import { DateTime, Effect, Layer, Metric } from "effect";

import { workerLastSuccess, workerPollResults } from "@namera-ai/telemetry";

import { emailPolicy } from "./data.js";
import { EmailJobs } from "./jobs.js";

export const EmailWorkerLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const jobs = yield* EmailJobs;

    yield* Effect.gen(function* () {
      while (true) {
        const processed = yield* jobs.processOnce.pipe(
          Effect.tap(() =>
            Effect.gen(function* () {
              yield* Metric.update(
                Metric.withAttributes(workerPollResults, { worker: "email", result: "success" }),
                1,
              );
              yield* Metric.update(
                Metric.withAttributes(workerLastSuccess, { worker: "email" }),
                DateTime.toEpochMillis(yield* DateTime.now) / 1000,
              );
            }),
          ),
          Effect.catchCause(() =>
            Effect.logError("email.worker.failed").pipe(
              Effect.andThen(
                Metric.update(
                  Metric.withAttributes(workerPollResults, { worker: "email", result: "failure" }),
                  1,
                ),
              ),
              Effect.as(0),
            ),
          ),
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
