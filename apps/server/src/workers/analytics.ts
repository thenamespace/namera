import { DateTime, Effect, Layer } from "effect";

import { CryptoService } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import { ProductAnalytics } from "@namera-ai/telemetry/analytics/server";

export const deliverNextMilestone = Effect.fnUntraced(function* () {
  const analytics = yield* ProductAnalytics;
  if (!analytics.enabled) return false;
  const repository = (yield* Repository).jobs.analytics;
  const crypto = yield* CryptoService;
  const lease = yield* crypto.randomToken(24);
  const job = yield* repository.claim(lease);
  if (!job) return false;
  if (!job.payload) return yield* Effect.die("Pending analytics job has no payload");
  yield* analytics
    .deliver({ ...job.payload, id: job.id, timestamp: DateTime.toDate(job.createdAt) })
    .pipe(
      Effect.matchEffect({
        onSuccess: () => repository.complete(job.id, lease),
        onFailure: () =>
          repository
            .retry(job.id, lease, job.attempts)
            .pipe(Effect.andThen(Effect.logWarning("analytics.delivery.retry"))),
      }),
    );
  return true;
});

export const AnalyticsWorkerLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const analytics = yield* ProductAnalytics;
    if (!analytics.enabled) return;
    yield* Effect.gen(function* () {
      while (true) {
        const processed = yield* deliverNextMilestone().pipe(
          Effect.catchCause(() =>
            Effect.logError("analytics.worker.failed").pipe(Effect.as(false)),
          ),
        );
        if (!processed) yield* Effect.sleep("5 seconds");
      }
    }).pipe(Effect.forkScoped);
  }),
);
