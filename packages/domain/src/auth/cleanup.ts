import { AdminDatabase, session } from "@namera-ai/database";
import { lt } from "drizzle-orm";
import { Duration, Effect, Layer, Schedule } from "effect";

export const SessionJanitorLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const db = yield* AdminDatabase;

    // Define the cleanup task
    const cleanupTask = Effect.gen(function* () {
      // Prune sessions older than 7 days
      const cutoffDate = new Date(
        Date.now() - Duration.toMillis(Duration.days(7)),
      );

      yield* Effect.logInfo(
        "SessionJanitor: Starting cleanup of expired sessions...",
      );

      yield* db
        .delete(session)
        .where(lt(session.expiresAt, cutoffDate))
        .pipe(
          Effect.catchAll((error) =>
            Effect.logError("SessionJanitor: Database delete failed", error),
          ),
        );

      yield* Effect.logInfo(
        "SessionJanitor: Successfully pruned expired sessions.",
      );
    });

    // Run the cleanup task every 7 days
    const janitorSchedule = Schedule.spaced(Duration.days(7));

    yield* cleanupTask.pipe(Effect.repeat(janitorSchedule), Effect.forkDaemon);
  }),
);
