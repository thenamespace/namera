// oxlint-disable typescript/no-explicit-any
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { BillingProviderEventId, DatabaseError } from "@namera-ai/protocol";
import {
  BillingProviderEvent,
  BillingProviderEventInsert,
  type BillingProvider,
  type BillingProviderEvent as BillingProviderEventModel,
  type BillingProviderEventInsert as BillingProviderEventInsertModel,
} from "@namera-ai/protocol/model";
import { and, asc, eq, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { billingProviderEvent } from "#/schema/index";

export interface BillingProviderEventRepositoryService {
  readonly receive: (
    data: BillingProviderEventInsertModel,
  ) => Effect.Effect<
    { readonly event: BillingProviderEventModel; readonly inserted: boolean },
    DatabaseError
  >;
  readonly findById: (
    id: BillingProviderEventId,
  ) => Effect.Effect<BillingProviderEventModel | undefined, DatabaseError>;
  readonly findByProviderId: (
    provider: BillingProvider,
    providerEventId: string,
  ) => Effect.Effect<BillingProviderEventModel | undefined, DatabaseError>;
  readonly listPending: (
    limit: number,
  ) => Effect.Effect<ReadonlyArray<BillingProviderEventModel>, DatabaseError>;
  readonly markProcessed: (
    id: BillingProviderEventId,
    processedAt: DateTime.Utc,
  ) => Effect.Effect<BillingProviderEventModel | undefined, DatabaseError>;
  readonly markFailed: (
    id: BillingProviderEventId,
    lastError: string,
  ) => Effect.Effect<BillingProviderEventModel | undefined, DatabaseError>;
}

export class BillingProviderEventRepository extends Context.Service<
  BillingProviderEventRepository,
  BillingProviderEventRepositoryService
>()("@namera-ai/database/BillingProviderEventRepository") {
  static readonly layer: Layer.Layer<BillingProviderEventRepository, never, Database> =
    Layer.effect(
      BillingProviderEventRepository,
      Effect.gen(function* () {
        const database = yield* Database;
        return BillingProviderEventRepository.of({
          receive: Effect.fn("database.billingProviderEventRepository.receive")(function* (data) {
            const db = yield* transactionOrDatabase(database);
            const inserted = yield* db
              .insert(billingProviderEvent)
              .values(Schema.encodeSync(BillingProviderEventInsert)(data) as any)
              .onConflictDoNothing({
                target: [billingProviderEvent.provider, billingProviderEvent.providerEventId],
              })
              .returning();
            if (inserted[0])
              return {
                event: Schema.decodeUnknownSync(BillingProviderEvent)(inserted[0]),
                inserted: true,
              };
            const existing = yield* db.query.billingProviderEvent.findFirst({
              where: {
                provider: { eq: data.provider },
                providerEventId: { eq: data.providerEventId },
              },
            });
            if (!existing)
              return yield* Effect.die("Billing provider event conflict returned no row");
            return {
              event: Schema.decodeUnknownSync(BillingProviderEvent)(existing),
              inserted: false,
            };
          }, mapRepositoryError),
          findById: Effect.fn("database.billingProviderEventRepository.findById")(function* (id) {
            const db = yield* transactionOrDatabase(database);
            const row = yield* db.query.billingProviderEvent.findFirst({
              where: { id: { eq: id } },
            });
            return row ? Schema.decodeUnknownSync(BillingProviderEvent)(row) : undefined;
          }, mapRepositoryError),
          findByProviderId: Effect.fn("database.billingProviderEventRepository.findByProviderId")(
            function* (provider, providerEventId) {
              const db = yield* transactionOrDatabase(database);
              const row = yield* db.query.billingProviderEvent.findFirst({
                where: { provider: { eq: provider }, providerEventId: { eq: providerEventId } },
              });
              return row ? Schema.decodeUnknownSync(BillingProviderEvent)(row) : undefined;
            },
            mapRepositoryError,
          ),
          listPending: Effect.fn("database.billingProviderEventRepository.listPending")(function* (
            limit,
          ) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(billingProviderEvent)
              .where(eq(billingProviderEvent.status, "pending"))
              .orderBy(asc(billingProviderEvent.createdAt))
              .limit(limit);
            return Schema.decodeUnknownSync(Schema.Array(BillingProviderEvent))(rows);
          }, mapRepositoryError),
          markProcessed: Effect.fn("database.billingProviderEventRepository.markProcessed")(
            function* (id, processedAt) {
              const db = yield* transactionOrDatabase(database);
              const rows = yield* db
                .update(billingProviderEvent)
                .set({
                  status: "processed",
                  attempts: sql`${billingProviderEvent.attempts} + 1`,
                  processedAt: Schema.encodeSync(Schema.DateTimeUtcFromDate)(processedAt),
                  lastError: null,
                })
                .where(
                  and(eq(billingProviderEvent.id, id), eq(billingProviderEvent.status, "pending")),
                )
                .returning();
              return rows[0] ? Schema.decodeUnknownSync(BillingProviderEvent)(rows[0]) : undefined;
            },
            mapRepositoryError,
          ),
          markFailed: Effect.fn("database.billingProviderEventRepository.markFailed")(function* (
            id,
            lastError,
          ) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .update(billingProviderEvent)
              .set({
                status: "failed",
                attempts: sql`${billingProviderEvent.attempts} + 1`,
                lastError,
              })
              .where(
                and(eq(billingProviderEvent.id, id), eq(billingProviderEvent.status, "pending")),
              )
              .returning();
            return rows[0] ? Schema.decodeUnknownSync(BillingProviderEvent)(rows[0]) : undefined;
          }, mapRepositoryError),
        });
      }),
    );
}
