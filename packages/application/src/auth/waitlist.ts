import { DateTime, Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { type Email, WaitlistNotFoundError } from "@namera-ai/protocol";
import type { ListWaitlistRequest } from "@namera-ai/protocol/dto";
import type { WaitlistStatus } from "@namera-ai/protocol/model";
import { waitlistJoins, waitlistStatusChanges } from "@namera-ai/telemetry";

export const makeWaitlistApplication = Effect.gen(function* () {
  const repository = (yield* Repository).auth.waitlist;
  const transaction = yield* TransactionService;

  const join = Effect.fn("application.waitlist.join")(function* (email: Email) {
    const created = yield* repository.join(email);
    if (created) yield* Metric.update(waitlistJoins, 1);
    return { accepted: true as const };
  }, Effect.orDie);

  const list = Effect.fn("application.waitlist.list")(function* (input: ListWaitlistRequest) {
    const limit = input.limit ?? 50;
    const rows = yield* repository.list({
      ...input,
      limit,
      ...(input.search === undefined ? {} : { search: input.search.trim().toLowerCase() }),
    });
    const entries = rows.slice(0, limit);
    return { entries, nextCursor: rows.length > limit ? (entries.at(-1)?.id ?? null) : null };
  }, Effect.orDie);

  const setStatus = Effect.fn("application.waitlist.setStatus")(
    function* (id: string, status: WaitlistStatus) {
      const result = yield* transaction.run(
        Effect.gen(function* () {
          const entry = yield* repository.lock(id);
          if (!entry) return yield* new WaitlistNotFoundError({ code: "WAITLIST_NOT_FOUND" });
          if (entry.status === status) return { entry, changed: false };
          const now = yield* DateTime.now;
          const updated = yield* repository.setStatus(id, status, now);
          yield* repository.appendEvent(id, entry.status, status, now);
          return { entry: updated, changed: true };
        }),
      );
      if (result.changed) {
        yield* Metric.update(Metric.withAttributes(waitlistStatusChanges, { status }), 1);
      }
      return result.entry;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { join, list, setStatus };
});
