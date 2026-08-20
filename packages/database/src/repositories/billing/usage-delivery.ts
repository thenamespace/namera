// oxlint-disable typescript/no-explicit-any
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { BillingUsageDeliveryId, DatabaseError, OrganizationId } from "@namera-ai/protocol";
import {
  BillingUsageDelivery,
  BillingUsageDeliveryInsert,
  type BillingUsageDelivery as BillingUsageDeliveryModel,
  type BillingUsageDeliveryInsert as BillingUsageDeliveryInsertModel,
} from "@namera-ai/protocol/model";
import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { billingUsageDelivery } from "#/schema/index";

const encodeDate = Schema.encodeSync(Schema.DateTimeUtcFromDate);

export interface BillingUsageDeliveryRepositoryService {
  readonly enqueue: (
    data: BillingUsageDeliveryInsertModel,
  ) => Effect.Effect<
    { readonly delivery: BillingUsageDeliveryModel; readonly inserted: boolean },
    DatabaseError
  >;
  readonly findById: (
    organizationId: OrganizationId,
    id: BillingUsageDeliveryId,
  ) => Effect.Effect<BillingUsageDeliveryModel | undefined, DatabaseError>;
  readonly listDue: (
    now: DateTime.Utc,
    limit: number,
  ) => Effect.Effect<ReadonlyArray<BillingUsageDeliveryModel>, DatabaseError>;
  readonly markDelivered: (
    organizationId: OrganizationId,
    id: BillingUsageDeliveryId,
    providerUsageId: string | null,
    deliveredAt: DateTime.Utc,
  ) => Effect.Effect<BillingUsageDeliveryModel | undefined, DatabaseError>;
  readonly reschedule: (
    organizationId: OrganizationId,
    id: BillingUsageDeliveryId,
    nextAttemptAt: DateTime.Utc,
    lastError: string,
  ) => Effect.Effect<BillingUsageDeliveryModel | undefined, DatabaseError>;
  readonly markFailed: (
    organizationId: OrganizationId,
    id: BillingUsageDeliveryId,
    lastError: string,
  ) => Effect.Effect<BillingUsageDeliveryModel | undefined, DatabaseError>;
}

export class BillingUsageDeliveryRepository extends Context.Service<
  BillingUsageDeliveryRepository,
  BillingUsageDeliveryRepositoryService
>()("@namera-ai/database/BillingUsageDeliveryRepository") {
  static readonly layer: Layer.Layer<BillingUsageDeliveryRepository, never, Database> =
    Layer.effect(
      BillingUsageDeliveryRepository,
      Effect.gen(function* () {
        const database = yield* Database;
        return BillingUsageDeliveryRepository.of({
          enqueue: Effect.fn("database.billingUsageDeliveryRepository.enqueue")(function* (data) {
            const db = yield* transactionOrDatabase(database);
            const inserted = yield* db
              .insert(billingUsageDelivery)
              .values(Schema.encodeSync(BillingUsageDeliveryInsert)(data) as any)
              .onConflictDoNothing({
                target: [
                  billingUsageDelivery.usageEventId,
                  billingUsageDelivery.provider,
                  billingUsageDelivery.destination,
                ],
              })
              .returning();
            if (inserted[0])
              return {
                delivery: Schema.decodeUnknownSync(BillingUsageDelivery)(inserted[0]),
                inserted: true,
              };
            const existing = yield* db.query.billingUsageDelivery.findFirst({
              where: {
                usageEventId: { eq: data.usageEventId },
                provider: { eq: data.provider },
                destination: { eq: data.destination },
              },
            });
            if (!existing)
              return yield* Effect.die("Billing usage delivery conflict returned no row");
            return {
              delivery: Schema.decodeUnknownSync(BillingUsageDelivery)(existing),
              inserted: false,
            };
          }, mapRepositoryError),
          findById: Effect.fn("database.billingUsageDeliveryRepository.findById")(function* (
            organizationId,
            id,
          ) {
            const db = yield* transactionOrDatabase(database);
            const row = yield* db.query.billingUsageDelivery.findFirst({
              where: { organizationId: { eq: organizationId }, id: { eq: id } },
            });
            return row ? Schema.decodeUnknownSync(BillingUsageDelivery)(row) : undefined;
          }, mapRepositoryError),
          listDue: Effect.fn("database.billingUsageDeliveryRepository.listDue")(function* (
            now,
            limit,
          ) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = encodeDate(now);
            const rows = yield* db
              .select()
              .from(billingUsageDelivery)
              .where(
                and(
                  or(
                    eq(billingUsageDelivery.status, "pending"),
                    eq(billingUsageDelivery.status, "retrying"),
                  ),
                  or(
                    isNull(billingUsageDelivery.nextAttemptAt),
                    lte(billingUsageDelivery.nextAttemptAt, encodedNow),
                  ),
                ),
              )
              .orderBy(asc(billingUsageDelivery.createdAt))
              .limit(limit);
            return Schema.decodeUnknownSync(Schema.Array(BillingUsageDelivery))(rows);
          }, mapRepositoryError),
          markDelivered: Effect.fn("database.billingUsageDeliveryRepository.markDelivered")(
            function* (organizationId, id, providerUsageId, deliveredAt) {
              const db = yield* transactionOrDatabase(database);
              const rows = yield* db
                .update(billingUsageDelivery)
                .set({
                  status: "delivered",
                  providerUsageId,
                  deliveredAt: encodeDate(deliveredAt),
                  attempts: sql`${billingUsageDelivery.attempts} + 1`,
                })
                .where(
                  and(
                    eq(billingUsageDelivery.organizationId, organizationId),
                    eq(billingUsageDelivery.id, id),
                    or(
                      eq(billingUsageDelivery.status, "pending"),
                      eq(billingUsageDelivery.status, "retrying"),
                    ),
                  ),
                )
                .returning();
              return rows[0] ? Schema.decodeUnknownSync(BillingUsageDelivery)(rows[0]) : undefined;
            },
            mapRepositoryError,
          ),
          reschedule: Effect.fn("database.billingUsageDeliveryRepository.reschedule")(function* (
            organizationId,
            id,
            nextAttemptAt,
            lastError,
          ) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .update(billingUsageDelivery)
              .set({
                status: "retrying",
                attempts: sql`${billingUsageDelivery.attempts} + 1`,
                nextAttemptAt: encodeDate(nextAttemptAt),
                lastError,
              })
              .where(
                and(
                  eq(billingUsageDelivery.organizationId, organizationId),
                  eq(billingUsageDelivery.id, id),
                  or(
                    eq(billingUsageDelivery.status, "pending"),
                    eq(billingUsageDelivery.status, "retrying"),
                  ),
                ),
              )
              .returning();
            return rows[0] ? Schema.decodeUnknownSync(BillingUsageDelivery)(rows[0]) : undefined;
          }, mapRepositoryError),
          markFailed: Effect.fn("database.billingUsageDeliveryRepository.markFailed")(function* (
            organizationId,
            id,
            lastError,
          ) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .update(billingUsageDelivery)
              .set({
                status: "failed",
                attempts: sql`${billingUsageDelivery.attempts} + 1`,
                nextAttemptAt: null,
                lastError,
              })
              .where(
                and(
                  eq(billingUsageDelivery.organizationId, organizationId),
                  eq(billingUsageDelivery.id, id),
                  or(
                    eq(billingUsageDelivery.status, "pending"),
                    eq(billingUsageDelivery.status, "retrying"),
                  ),
                ),
              )
              .returning();
            return rows[0] ? Schema.decodeUnknownSync(BillingUsageDelivery)(rows[0]) : undefined;
          }, mapRepositoryError),
        });
      }),
    );
}
