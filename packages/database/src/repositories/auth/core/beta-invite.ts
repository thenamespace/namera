import { Context, DateTime, Effect, Layer, Schema } from "effect";

import type { Email, UserId } from "@namera-ai/protocol";
import {
  BetaInvite,
  type BetaInviteEventType,
  BetaInviteListEntry,
  type BetaInviteStatus,
} from "@namera-ai/protocol/model";
import { and, desc, eq, gt, isNotNull, isNull, lt, lte, sql, type SQL } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { betaInvite, betaInviteEvent, user } from "#/schema/index";

const decode = (rows: unknown[]) =>
  rows[0] ? Schema.decodeUnknownSync(BetaInvite)(rows[0]) : undefined;

/**
 * Status is derived, never stored. Priority is redeemed > revoked > expired >
 * active; the first two are mutually exclusive by `beta_invite_terminal_check`,
 * so the order only matters for readability.
 *
 * The cutoff is the caller's timestamp rather than the database `now()`, and
 * the projection and the filter predicates share it. That keeps a listed status
 * agreeing both with the filter that selected it and with `lockActive`, which
 * decides redemption against the same application clock.
 */
const statusSql = (now: Date) => sql<BetaInviteStatus>`case
  when ${betaInvite.redeemedAt} is not null then 'redeemed'
  when ${betaInvite.revokedAt} is not null then 'revoked'
  when ${betaInvite.expiresAt} <= ${now} then 'expired'
  else 'active'
end`;

const statusPredicate = (now: Date): Record<BetaInviteStatus, SQL | undefined> => ({
  redeemed: isNotNull(betaInvite.redeemedAt),
  revoked: and(isNull(betaInvite.redeemedAt), isNotNull(betaInvite.revokedAt)),
  expired: and(
    isNull(betaInvite.redeemedAt),
    isNull(betaInvite.revokedAt),
    lte(betaInvite.expiresAt, now),
  ),
  active: and(
    isNull(betaInvite.redeemedAt),
    isNull(betaInvite.revokedAt),
    gt(betaInvite.expiresAt, now),
  ),
});

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
    list: Effect.fn("database.betaInvite.list")(function* (input: {
      readonly limit: number;
      readonly cursor?: string;
      readonly status?: BetaInviteStatus;
      readonly email?: string;
      readonly now: DateTime.Utc;
    }) {
      const db = yield* transactionOrDatabase(database);
      const now = DateTime.toDateUtc(input.now);
      const rows = yield* db
        .select({
          id: betaInvite.id,
          email: betaInvite.email,
          createdAt: betaInvite.createdAt,
          expiresAt: betaInvite.expiresAt,
          redeemedAt: betaInvite.redeemedAt,
          redeemedBy: betaInvite.redeemedBy,
          redeemedByEmail: user.email,
          redeemedByMetadata: user.metadata,
          revokedAt: betaInvite.revokedAt,
          status: statusSql(now),
        })
        .from(betaInvite)
        .leftJoin(user, eq(betaInvite.redeemedBy, user.id))
        .where(
          and(
            // id is a uuidv7, so ordering by it is creation order.
            input.cursor ? lt(betaInvite.id, input.cursor) : undefined,
            input.status ? statusPredicate(now)[input.status] : undefined,
            // Literal substring search: '%' and '_' in addresses are not wildcards.
            input.email ? sql`strpos(lower(${betaInvite.email}), ${input.email}) > 0` : undefined,
          ),
        )
        .orderBy(desc(betaInvite.id))
        .limit(input.limit + 1);
      return Schema.decodeUnknownSync(Schema.Array(BetaInviteListEntry))(rows);
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
  };
});
export class BetaInviteRepository extends Context.Service<
  BetaInviteRepository,
  Effect.Success<typeof make>
>()("@namera-ai/database/BetaInviteRepository") {
  static readonly layer = Layer.effect(BetaInviteRepository, make);
}
