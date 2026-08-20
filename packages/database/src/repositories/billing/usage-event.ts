// oxlint-disable typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type {
  BillingPeriodId,
  BillingUsageEventId,
  DatabaseError,
  OrganizationId,
} from "@namera-ai/protocol";
import {
  BillingUsageEvent,
  BillingUsageEventInsert,
  type BillingMeterKey,
  type BillingUsageEvent as BillingUsageEventModel,
  type BillingUsageEventInsert as BillingUsageEventInsertModel,
} from "@namera-ai/protocol/model";
import { and, desc, eq, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { billingUsageEvent } from "#/schema/index";

export interface BillingUsageEventRepositoryService {
  readonly append: (
    data: BillingUsageEventInsertModel,
  ) => Effect.Effect<
    { readonly event: BillingUsageEventModel; readonly inserted: boolean },
    DatabaseError
  >;
  readonly findById: (
    organizationId: OrganizationId,
    id: BillingUsageEventId,
  ) => Effect.Effect<BillingUsageEventModel | undefined, DatabaseError>;
  readonly findByIdempotencyKey: (
    organizationId: OrganizationId,
    idempotencyKey: string,
  ) => Effect.Effect<BillingUsageEventModel | undefined, DatabaseError>;
  readonly listForMeter: (
    organizationId: OrganizationId,
    periodId: BillingPeriodId,
    meterKey: BillingMeterKey,
  ) => Effect.Effect<ReadonlyArray<BillingUsageEventModel>, DatabaseError>;
  readonly getNetAmount: (
    organizationId: OrganizationId,
    periodId: BillingPeriodId,
    meterKey: BillingMeterKey,
  ) => Effect.Effect<bigint, DatabaseError>;
}

export class BillingUsageEventRepository extends Context.Service<
  BillingUsageEventRepository,
  BillingUsageEventRepositoryService
>()("@namera-ai/database/BillingUsageEventRepository") {
  static readonly layer: Layer.Layer<BillingUsageEventRepository, never, Database> = Layer.effect(
    BillingUsageEventRepository,
    Effect.gen(function* () {
      const database = yield* Database;
      return BillingUsageEventRepository.of({
        append: Effect.fn("database.billingUsageEventRepository.append")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const inserted = yield* db
            .insert(billingUsageEvent)
            .values(Schema.encodeSync(BillingUsageEventInsert)(data) as any)
            .onConflictDoNothing({
              target: [billingUsageEvent.organizationId, billingUsageEvent.idempotencyKey],
            })
            .returning();
          if (inserted[0])
            return {
              event: Schema.decodeUnknownSync(BillingUsageEvent)(inserted[0]),
              inserted: true,
            };
          const existing = yield* db.query.billingUsageEvent.findFirst({
            where: {
              organizationId: { eq: data.organizationId },
              idempotencyKey: { eq: data.idempotencyKey },
            },
          });
          if (!existing) return yield* Effect.die("Billing usage event conflict returned no row");
          return { event: Schema.decodeUnknownSync(BillingUsageEvent)(existing), inserted: false };
        }, mapRepositoryError),
        findById: Effect.fn("database.billingUsageEventRepository.findById")(function* (
          organizationId,
          id,
        ) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.billingUsageEvent.findFirst({
            where: { organizationId: { eq: organizationId }, id: { eq: id } },
          });
          return row ? Schema.decodeUnknownSync(BillingUsageEvent)(row) : undefined;
        }, mapRepositoryError),
        findByIdempotencyKey: Effect.fn(
          "database.billingUsageEventRepository.findByIdempotencyKey",
        )(function* (organizationId, idempotencyKey) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.billingUsageEvent.findFirst({
            where: {
              organizationId: { eq: organizationId },
              idempotencyKey: { eq: idempotencyKey },
            },
          });
          return row ? Schema.decodeUnknownSync(BillingUsageEvent)(row) : undefined;
        }, mapRepositoryError),
        listForMeter: Effect.fn("database.billingUsageEventRepository.listForMeter")(function* (
          organizationId,
          periodId,
          meterKey,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(billingUsageEvent)
            .where(
              and(
                eq(billingUsageEvent.organizationId, organizationId),
                eq(billingUsageEvent.periodId, periodId),
                eq(billingUsageEvent.meterKey, meterKey),
              ),
            )
            .orderBy(desc(billingUsageEvent.occurredAt), desc(billingUsageEvent.id));
          return Schema.decodeUnknownSync(Schema.Array(BillingUsageEvent))(rows);
        }, mapRepositoryError),
        getNetAmount: Effect.fn("database.billingUsageEventRepository.getNetAmount")(function* (
          organizationId,
          periodId,
          meterKey,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select({
              amount: sql<string>`coalesce(sum(case when ${billingUsageEvent.direction} = 'debit' then ${billingUsageEvent.amount} else -${billingUsageEvent.amount} end), 0)`,
            })
            .from(billingUsageEvent)
            .where(
              and(
                eq(billingUsageEvent.organizationId, organizationId),
                eq(billingUsageEvent.periodId, periodId),
                eq(billingUsageEvent.meterKey, meterKey),
              ),
            );
          return BigInt(rows[0]?.amount ?? "0");
        }, mapRepositoryError),
      });
    }),
  );
}
