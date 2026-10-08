import { Context, DateTime, Effect, Layer, Schema } from "effect";

import type { Email } from "@namera-ai/protocol";
import type { ListWaitlistRequest } from "@namera-ai/protocol/dto";
import { WaitlistEntry } from "@namera-ai/protocol/model";
import { and, desc, eq, lt, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { waitlist, waitlistEvent } from "#/schema/index";

const decode = (rows: unknown[]) =>
  rows[0] ? Schema.decodeUnknownSync(WaitlistEntry)(rows[0]) : undefined;

const make = Effect.gen(function* () {
  const database = yield* Database;
  return {
    list: Effect.fn("database.waitlist.list")(function* (
      input: ListWaitlistRequest & { readonly limit: number },
    ) {
      const db = yield* transactionOrDatabase(database);
      return Schema.decodeUnknownSync(Schema.Array(WaitlistEntry))(
        yield* db
          .select()
          .from(waitlist)
          .where(
            and(
              input.status ? eq(waitlist.status, input.status) : undefined,
              input.cursor ? lt(waitlist.id, input.cursor) : undefined,
              input.email ? sql`strpos(lower(${waitlist.email}), ${input.email}) > 0` : undefined,
            ),
          )
          .orderBy(desc(waitlist.id))
          .limit(input.limit + 1),
      );
    }, mapRepositoryError),
    completePending: Effect.fn("database.waitlist.completePending")(function* (
      id: string,
      now: DateTime.Utc,
    ) {
      const db = yield* transactionOrDatabase(database);
      return decode(
        yield* db
          .update(waitlist)
          .set({
            status: "completed",
            completedAt: DateTime.toDateUtc(now),
            updatedAt: DateTime.toDateUtc(now),
          })
          .where(and(eq(waitlist.id, id), eq(waitlist.status, "pending")))
          .returning(),
      );
    }, mapRepositoryError),
    appendAcceptance: Effect.fn("database.waitlist.appendAcceptance")(function* (id: string) {
      const db = yield* transactionOrDatabase(database);
      yield* db
        .insert(waitlistEvent)
        .values({ waitlistId: id, previousStatus: "pending", status: "completed" });
    }, mapRepositoryError),
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
  };
});

export class WaitlistRepository extends Context.Service<
  WaitlistRepository,
  Effect.Success<typeof make>
>()("@namera-ai/database/WaitlistRepository") {
  static readonly layer = Layer.effect(WaitlistRepository, make);
}
