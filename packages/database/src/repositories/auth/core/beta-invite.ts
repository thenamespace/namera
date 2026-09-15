import { Context, DateTime, Effect, Layer, Schema } from "effect";

import type { Email, UserId } from "@namera-ai/protocol";
import { BetaInvite, type BetaInviteEventType } from "@namera-ai/protocol/model";
import { and, eq, gt, isNull } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { betaInvite, betaInviteEvent } from "#/schema/index";

const decode = (rows: unknown[]) =>
  rows[0] ? Schema.decodeUnknownSync(BetaInvite)(rows[0]) : undefined;

const make = Effect.gen(function* () {
  const database = yield* Database;
  return {
    appendEvent: Effect.fn("database.betaInvite.appendEvent")(function* (
      inviteId: string,
      event: BetaInviteEventType,
    ) {
      const db = yield* transactionOrDatabase(database);
      yield* db.insert(betaInviteEvent).values({ inviteId, event });
    }, mapRepositoryError),
    create: Effect.fn("database.betaInvite.create")(function* (input: {
      codeHmac: string;
      email: Email | null;
      createdAt: DateTime.Utc;
      expiresAt: DateTime.Utc;
    }) {
      const db = yield* transactionOrDatabase(database);
      return decode(
        yield* db
          .insert(betaInvite)
          .values({
            ...input,
            createdAt: DateTime.toDateUtc(input.createdAt),
            expiresAt: DateTime.toDateUtc(input.expiresAt),
          })
          .onConflictDoNothing()
          .returning(),
      );
    }, mapRepositoryError),
    findByHmac: Effect.fn("database.betaInvite.findByHmac")(function* (codeHmac: string) {
      const db = yield* transactionOrDatabase(database);
      return decode(yield* db.select().from(betaInvite).where(eq(betaInvite.codeHmac, codeHmac)));
    }, mapRepositoryError),
    lockActive: Effect.fn("database.betaInvite.lockActive")(function* (
      id: string,
      now: DateTime.Utc,
    ) {
      const db = yield* transactionOrDatabase(database);
      return decode(
        yield* db
          .select()
          .from(betaInvite)
          .where(
            and(
              eq(betaInvite.id, id),
              isNull(betaInvite.redeemedAt),
              isNull(betaInvite.revokedAt),
              gt(betaInvite.expiresAt, DateTime.toDateUtc(now)),
            ),
          )
          .for("update"),
      );
    }, mapRepositoryError),
    redeem: Effect.fn("database.betaInvite.redeem")(function* (
      id: string,
      userId: UserId,
      now: DateTime.Utc,
    ) {
      const db = yield* transactionOrDatabase(database);
      return decode(
        yield* db
          .update(betaInvite)
          .set({ redeemedAt: DateTime.toDateUtc(now), redeemedBy: userId })
          .where(
            and(
              eq(betaInvite.id, id),
              isNull(betaInvite.redeemedAt),
              isNull(betaInvite.revokedAt),
              gt(betaInvite.expiresAt, DateTime.toDateUtc(now)),
            ),
          )
          .returning(),
      );
    }, mapRepositoryError),
    revoke: Effect.fn("database.betaInvite.revoke")(function* (id: string, now: DateTime.Utc) {
      const db = yield* transactionOrDatabase(database);
      return decode(
        yield* db
          .update(betaInvite)
          .set({ revokedAt: DateTime.toDateUtc(now) })
          .where(
            and(eq(betaInvite.id, id), isNull(betaInvite.redeemedAt), isNull(betaInvite.revokedAt)),
          )
          .returning(),
      );
    }, mapRepositoryError),
  };
});
export class BetaInviteRepository extends Context.Service<
  BetaInviteRepository,
  Effect.Success<typeof make>
>()("@namera-ai/database/BetaInviteRepository") {
  static readonly layer = Layer.effect(BetaInviteRepository, make);
}
