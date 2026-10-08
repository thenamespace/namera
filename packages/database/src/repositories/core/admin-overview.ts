import { Context, DateTime, Effect, Layer, Schema } from "effect";

import type { DatabaseError } from "@namera-ai/protocol";
import {
  AdminOverviewCounts,
  AdminOverviewState,
  type AdminOverviewPoint,
} from "@namera-ai/protocol/dto";
import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { user, waitlist, wallet, sessionKey, execution, signatureOperation } from "#/schema/index";

const decodeCount = Schema.decodeSync(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)));
const count = (condition?: SQL) =>
  (condition ? sql`count(*) filter (where ${condition})` : sql`count(*)`).mapWith((value) =>
    decodeCount(Number(value)),
  );

export interface AdminOverviewSnapshot {
  readonly totals: typeof AdminOverviewCounts.Type;
  readonly current: typeof AdminOverviewState.Type;
  readonly activity: ReadonlyArray<AdminOverviewPoint>;
}

export class AdminOverviewRepository extends Context.Service<
  AdminOverviewRepository,
  {
    readonly snapshot: (now: DateTime.Utc) => Effect.Effect<AdminOverviewSnapshot, DatabaseError>;
  }
>()("@namera-ai/database/AdminOverviewRepository") {
  static readonly layer = Layer.effect(
    AdminOverviewRepository,
    Effect.gen(function* () {
      const database = yield* Database;
      return AdminOverviewRepository.of({
        snapshot: Effect.fn("database.adminOverview.snapshot")(function* (now) {
          const db = yield* transactionOrDatabase(database);
          const end = DateTime.toDateUtc(now);
          const firstDay = DateTime.subtract(DateTime.startOf(now, "day"), { days: 89 });
          const since = DateTime.toDateUtc(firstDay);

          const [users, entries, accounts, keys, executions, signatures] = yield* Effect.all(
            [
              db.select({ total: count() }).from(user).where(lte(user.createdAt, end)),
              db
                .select({ total: count(), pending: count(eq(waitlist.status, "pending")) })
                .from(waitlist)
                .where(lte(waitlist.createdAt, end)),
              db.select({ total: count() }).from(wallet).where(lte(wallet.createdAt, end)),
              db
                .select({
                  total: count(),
                  active: count(eq(sessionKey.status, "active")),
                  revoked: count(eq(sessionKey.status, "revoked")),
                })
                .from(sessionKey)
                .where(lte(sessionKey.createdAt, end)),
              db.select({ total: count() }).from(execution).where(lte(execution.createdAt, end)),
              db
                .select({ total: count() })
                .from(signatureOperation)
                .where(
                  and(
                    eq(signatureOperation.status, "succeeded"),
                    lte(signatureOperation.succeededAt, end),
                  ),
                ),
            ],
            { concurrency: 2 },
          );

          const totals = Schema.decodeUnknownSync(AdminOverviewCounts)({
            users: users[0]?.total,
            waitlist: entries[0]?.total,
            accounts: accounts[0]?.total,
            sessionKeys: keys[0]?.total,
            executions: executions[0]?.total,
            signatures: signatures[0]?.total,
          });
          const current = Schema.decodeUnknownSync(AdminOverviewState)({
            pendingWaitlist: entries[0]?.pending,
            activeSessionKeys: keys[0]?.active,
            revokedSessionKeys: keys[0]?.revoked,
          });

          const byDay = Effect.fnUntraced(function* (
            table: PgTable,
            timestamp: PgColumn,
            condition?: SQL,
          ) {
            const date = sql<string>`to_char(${timestamp} at time zone 'UTC', 'YYYY-MM-DD')`;
            return yield* db
              .select({ date, count: count() })
              .from(table)
              .where(and(gte(timestamp, since), lte(timestamp, end), condition))
              .groupBy(date);
          });
          const daily = yield* Effect.all(
            {
              users: byDay(user, user.createdAt),
              waitlist: byDay(waitlist, waitlist.createdAt),
              accounts: byDay(wallet, wallet.createdAt),
              sessionKeys: byDay(sessionKey, sessionKey.createdAt),
              executions: byDay(execution, execution.createdAt),
              signatures: byDay(
                signatureOperation,
                signatureOperation.succeededAt,
                eq(signatureOperation.status, "succeeded"),
              ),
            },
            { concurrency: 2 },
          );
          const points = new Map<string, AdminOverviewPoint>();
          for (let offset = 0; offset < 90; offset += 1) {
            const date = DateTime.formatIsoDateUtc(DateTime.add(firstDay, { days: offset }));
            points.set(date, {
              date,
              users: 0,
              waitlist: 0,
              accounts: 0,
              sessionKeys: 0,
              executions: 0,
              signatures: 0,
            });
          }
          for (const key of Object.keys(daily) as Array<keyof typeof daily>) {
            for (const row of daily[key]) {
              const point = points.get(row.date);
              if (point) points.set(row.date, { ...point, [key]: row.count });
            }
          }
          return { totals, current, activity: [...points.values()] };
        }, mapRepositoryError),
      });
    }),
  );
}
