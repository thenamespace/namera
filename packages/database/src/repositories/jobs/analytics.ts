import { Context, DateTime, Effect, Layer, Schema } from "effect";

import type { ActorId } from "@namera-ai/protocol";
import { AnalyticsJob, ProductMilestone } from "@namera-ai/protocol/model";
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { analyticsJob, actor, organizationMember } from "#/schema/index";

const make = Effect.gen(function* () {
  const database = yield* Database;
  return {
    attribution: Effect.fn("database.analytics.attribution")(function* (actorId: ActorId) {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db
        .select({ kind: actor.type, userId: organizationMember.userId })
        .from(actor)
        .leftJoin(organizationMember, eq(organizationMember.actorId, actor.id))
        .where(eq(actor.id, actorId))
        .limit(1);
      const row = rows[0];
      if (!row) return undefined;
      if (row.kind === "user")
        return row.userId ? { actor_kind: row.kind, distinctId: row.userId } : undefined;
      return {
        actor_kind: row.kind,
        distinctId: `${row.kind}:${actorId}`,
      };
    }, mapRepositoryError),
    has: Effect.fn("database.analytics.has")(function* (dedupeKey: string) {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db
        .select({ id: analyticsJob.id })
        .from(analyticsJob)
        .where(eq(analyticsJob.dedupeKey, dedupeKey))
        .limit(1);
      return rows.length > 0;
    }, mapRepositoryError),
    enqueue: Effect.fn("database.analytics.enqueue")(function* (
      dedupeKey: string,
      payload: ProductMilestone,
    ) {
      const db = yield* transactionOrDatabase(database);
      const now = DateTime.toDate(yield* DateTime.now);
      yield* db
        .insert(analyticsJob)
        .values({
          dedupeKey,
          payload: Schema.encodeSync(ProductMilestone)(payload),
          createdAt: now,
          availableAt: now,
        })
        .onConflictDoNothing({ target: analyticsJob.dedupeKey });
    }, mapRepositoryError),
    claim: Effect.fnUntraced(function* (leaseToken: string) {
      const db = yield* transactionOrDatabase(database);
      const now = yield* DateTime.now;
      const candidate = db
        .select({ id: analyticsJob.id })
        .from(analyticsJob)
        .where(
          and(
            isNull(analyticsJob.deliveredAt),
            lte(analyticsJob.availableAt, DateTime.toDate(now)),
          ),
        )
        .orderBy(asc(analyticsJob.availableAt), asc(analyticsJob.id))
        .limit(1)
        .for("update", { skipLocked: true });
      const rows = yield* db
        .update(analyticsJob)
        .set({
          leaseToken,
          attempts: sql`${analyticsJob.attempts} + 1`,
          availableAt: DateTime.toDate(DateTime.add(now, { minutes: 2 })),
        })
        .where(eq(analyticsJob.id, sql`(${candidate})`))
        .returning();
      return rows[0] ? Schema.decodeUnknownSync(AnalyticsJob)(rows[0]) : undefined;
    }, mapRepositoryError),
    complete: Effect.fn("database.analytics.complete")(function* (id: string, leaseToken: string) {
      const db = yield* transactionOrDatabase(database);
      yield* db
        .update(analyticsJob)
        .set({ deliveredAt: DateTime.toDate(yield* DateTime.now), payload: null, leaseToken: null })
        .where(
          and(
            eq(analyticsJob.id, id),
            eq(analyticsJob.leaseToken, leaseToken),
            isNull(analyticsJob.deliveredAt),
          ),
        );
    }, mapRepositoryError),
    retry: Effect.fn("database.analytics.retry")(function* (
      id: string,
      leaseToken: string,
      attempts: number,
    ) {
      const db = yield* transactionOrDatabase(database);
      yield* db
        .update(analyticsJob)
        .set({
          leaseToken: null,
          availableAt: DateTime.toDate(
            DateTime.add(yield* DateTime.now, {
              seconds: Math.min(3600, 30 * 2 ** Math.min(attempts, 7)),
            }),
          ),
        })
        .where(
          and(
            eq(analyticsJob.id, id),
            eq(analyticsJob.leaseToken, leaseToken),
            isNull(analyticsJob.deliveredAt),
          ),
        );
    }, mapRepositoryError),
  };
});

export class AnalyticsJobRepository extends Context.Service<
  AnalyticsJobRepository,
  Effect.Success<typeof make>
>()("@namera-ai/database/AnalyticsJobRepository") {
  static readonly layer = Layer.effect(AnalyticsJobRepository, make);
}
