import { Context, Effect, Layer, Schema } from "effect";

import type { Email } from "@namera-ai/protocol";
import { WaitlistEntry } from "@namera-ai/protocol/model";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { waitlist } from "#/schema/index";

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
  };
});

export class WaitlistRepository extends Context.Service<
  WaitlistRepository,
  Effect.Success<typeof make>
>()("@namera-ai/database/WaitlistRepository") {
  static readonly layer = Layer.effect(WaitlistRepository, make);
}
