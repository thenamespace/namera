// oxlint-disable typescript/no-explicit-any
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type {
  BillingPeriodId,
  BillingSubscriptionId,
  DatabaseError,
  OrganizationId,
} from "@namera-ai/protocol";
import {
  BillingPeriod,
  BillingPeriodInsert,
  type BillingPeriod as BillingPeriodModel,
  type BillingPeriodInsert as BillingPeriodInsertModel,
} from "@namera-ai/protocol/model";
import { and, asc, desc, eq, gt, lte } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { billingPeriod } from "#/schema/index";

const encodeDate = Schema.encodeSync(Schema.DateTimeUtcFromDate);

export interface BillingPeriodRepositoryService {
  readonly insert: (
    data: BillingPeriodInsertModel,
  ) => Effect.Effect<BillingPeriodModel, DatabaseError>;
  readonly findById: (
    organizationId: OrganizationId,
    id: BillingPeriodId,
  ) => Effect.Effect<BillingPeriodModel | undefined, DatabaseError>;
  readonly findOpen: (
    organizationId: OrganizationId,
  ) => Effect.Effect<BillingPeriodModel | undefined, DatabaseError>;
  readonly findContaining: (
    organizationId: OrganizationId,
    at: DateTime.Utc,
  ) => Effect.Effect<BillingPeriodModel | undefined, DatabaseError>;
  readonly listForSubscription: (
    organizationId: OrganizationId,
    subscriptionId: BillingSubscriptionId,
  ) => Effect.Effect<ReadonlyArray<BillingPeriodModel>, DatabaseError>;
  readonly close: (
    organizationId: OrganizationId,
    id: BillingPeriodId,
    closedAt: DateTime.Utc,
  ) => Effect.Effect<BillingPeriodModel | undefined, DatabaseError>;
  readonly listExpiredOpen: (
    now: DateTime.Utc,
    limit: number,
  ) => Effect.Effect<ReadonlyArray<BillingPeriodModel>, DatabaseError>;
  readonly listOpen: (
    limit: number,
    afterId?: BillingPeriodId,
  ) => Effect.Effect<ReadonlyArray<BillingPeriodModel>, DatabaseError>;
}

export class BillingPeriodRepository extends Context.Service<
  BillingPeriodRepository,
  BillingPeriodRepositoryService
>()("@namera-ai/database/BillingPeriodRepository") {
  static readonly layer: Layer.Layer<BillingPeriodRepository, never, Database> = Layer.effect(
    BillingPeriodRepository,
    Effect.gen(function* () {
      const database = yield* Database;
      return BillingPeriodRepository.of({
        insert: Effect.fn("database.billingPeriodRepository.insert")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(BillingPeriodInsert)(data);
          const rows = yield* db
            .insert(billingPeriod)
            .values(encoded as any)
            .returning();
          const row = rows[0];
          if (!row) return yield* Effect.die("Billing period insert returned no row");
          return Schema.decodeUnknownSync(BillingPeriod)(row);
        }, mapRepositoryError),
        findById: Effect.fn("database.billingPeriodRepository.findById")(function* (
          organizationId,
          id,
        ) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.billingPeriod.findFirst({
            where: { id: { eq: id }, organizationId: { eq: organizationId } },
          });
          return row ? Schema.decodeUnknownSync(BillingPeriod)(row) : undefined;
        }, mapRepositoryError),
        findOpen: Effect.fn("database.billingPeriodRepository.findOpen")(function* (
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.billingPeriod.findFirst({
            where: { organizationId: { eq: organizationId }, status: { eq: "open" } },
          });
          return row ? Schema.decodeUnknownSync(BillingPeriod)(row) : undefined;
        }, mapRepositoryError),
        findContaining: Effect.fn("database.billingPeriodRepository.findContaining")(function* (
          organizationId,
          at,
        ) {
          const db = yield* transactionOrDatabase(database);
          const encodedAt = encodeDate(at);
          const rows = yield* db
            .select()
            .from(billingPeriod)
            .where(
              and(
                eq(billingPeriod.organizationId, organizationId),
                lte(billingPeriod.startsAt, encodedAt),
                gt(billingPeriod.endsAt, encodedAt),
              ),
            )
            .limit(1);
          return rows[0] ? Schema.decodeUnknownSync(BillingPeriod)(rows[0]) : undefined;
        }, mapRepositoryError),
        listForSubscription: Effect.fn("database.billingPeriodRepository.listForSubscription")(
          function* (organizationId, subscriptionId) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(billingPeriod)
              .where(
                and(
                  eq(billingPeriod.organizationId, organizationId),
                  eq(billingPeriod.subscriptionId, subscriptionId),
                ),
              )
              .orderBy(desc(billingPeriod.startsAt));
            return Schema.decodeUnknownSync(Schema.Array(BillingPeriod))(rows);
          },
          mapRepositoryError,
        ),
        close: Effect.fn("database.billingPeriodRepository.close")(function* (
          organizationId,
          id,
          closedAt,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(billingPeriod)
            .set({ status: "closed", closedAt: encodeDate(closedAt) })
            .where(
              and(
                eq(billingPeriod.organizationId, organizationId),
                eq(billingPeriod.id, id),
                eq(billingPeriod.status, "open"),
              ),
            )
            .returning();
          return rows[0] ? Schema.decodeUnknownSync(BillingPeriod)(rows[0]) : undefined;
        }, mapRepositoryError),
        listExpiredOpen: Effect.fn("database.billingPeriodRepository.listExpiredOpen")(function* (
          now,
          limit,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(billingPeriod)
            .where(
              and(eq(billingPeriod.status, "open"), lte(billingPeriod.endsAt, encodeDate(now))),
            )
            .orderBy(asc(billingPeriod.endsAt), asc(billingPeriod.id))
            .limit(Math.min(Math.max(Math.trunc(limit), 1), 100));
          return Schema.decodeUnknownSync(Schema.Array(BillingPeriod))(rows);
        }, mapRepositoryError),
        listOpen: Effect.fn("database.billingPeriodRepository.listOpen")(function* (
          limit,
          afterId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(billingPeriod)
            .where(
              afterId === undefined
                ? eq(billingPeriod.status, "open")
                : and(eq(billingPeriod.status, "open"), gt(billingPeriod.id, afterId)),
            )
            .orderBy(asc(billingPeriod.id))
            .limit(Math.min(Math.max(Math.trunc(limit), 1), 100));
          return Schema.decodeUnknownSync(Schema.Array(BillingPeriod))(rows);
        }, mapRepositoryError),
      });
    }),
  );
}
