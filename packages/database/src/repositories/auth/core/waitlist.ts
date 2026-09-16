import { Context, DateTime, Effect, Layer, Schema } from "effect";

import type { Email } from "@namera-ai/protocol";
import { WaitlistEntry, type WaitlistStatus } from "@namera-ai/protocol/model";
import { and, desc, eq, lt, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { waitlist, waitlistEvent } from "#/schema/index";

const decode = (rows: unknown[]) =>
  rows[0] ? Schema.decodeUnknownSync(WaitlistEntry)(rows[0]) : undefined;

const make = Effect.gen(function* () {
  const database = yield* Database;
  return {
    join: Effect.fn("database.waitlist.join")(function* (email: Email) {
      const db = yield* transactionOrDatabase(database);
      return decode(
        yield* db
          .insert(waitlist)
          .values({ email })
          .onConflictDoNothing({ target: waitlist.email })
          .returning(),
      );
    }, mapRepositoryError),
    list: Effect.fn("database.waitlist.list")(function* (input: {
      readonly limit: number;
      readonly cursor?: string;
      readonly status?: WaitlistStatus;
      readonly search?: string;
    }) {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db
        .select()
        .from(waitlist)
        .where(
          and(
            input.cursor ? lt(waitlist.id, input.cursor) : undefined,
            input.status ? eq(waitlist.status, input.status) : undefined,
            // Literal substring search: '%' and '_' in email addresses are not wildcards.
            input.search ? sql`strpos(${waitlist.email}, ${input.search}) > 0` : undefined,
          ),
        )
        .orderBy(desc(waitlist.id))
        .limit(input.limit + 1);
      return Schema.decodeUnknownSync(Schema.Array(WaitlistEntry))(rows);
    }, mapRepositoryError),
    lock: Effect.fn("database.waitlist.lock")(function* (id: string) {
      const db = yield* transactionOrDatabase(database);
      return decode(yield* db.select().from(waitlist).where(eq(waitlist.id, id)).for("update"));
    }, mapRepositoryError),
    setStatus: Effect.fn("database.waitlist.setStatus")(function* (
      id: string,
      status: WaitlistStatus,
      now: DateTime.Utc,
    ) {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db
        .update(waitlist)
        .set({
          status,
          updatedAt: DateTime.toDateUtc(now),
          completedAt: status === "completed" ? DateTime.toDateUtc(now) : null,
        })
        .where(eq(waitlist.id, id))
        .returning();
      return Schema.decodeUnknownSync(WaitlistEntry)(rows[0]);
    }, mapRepositoryError),
    appendEvent: Effect.fn("database.waitlist.appendEvent")(function* (
      waitlistId: string,
      previousStatus: WaitlistStatus,
      status: WaitlistStatus,
      now: DateTime.Utc,
    ) {
      const db = yield* transactionOrDatabase(database);
      yield* db
        .insert(waitlistEvent)
        .values({ waitlistId, previousStatus, status, createdAt: DateTime.toDateUtc(now) });
    }, mapRepositoryError),
  };
});

export class WaitlistRepository extends Context.Service<
  WaitlistRepository,
  Effect.Success<typeof make>
>()("@namera-ai/database/WaitlistRepository") {
  static readonly layer = Layer.effect(WaitlistRepository, make);
}
