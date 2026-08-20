// oxlint-disable typescript/no-explicit-any
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type {
  BillingSubscriptionId,
  BillingSubscriptionItemId,
  DatabaseError,
  OrganizationId,
} from "@namera-ai/protocol";
import {
  BillingSubscriptionItem,
  BillingSubscriptionItemInsert,
  type BillingSubscriptionComponentKey,
  type BillingSubscriptionItem as BillingSubscriptionItemModel,
  type BillingSubscriptionItemInsert as BillingSubscriptionItemInsertModel,
} from "@namera-ai/protocol/model";
import { and, asc, eq } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { billingSubscriptionItem } from "#/schema/index";

export interface BillingSubscriptionItemRepositoryService {
  readonly insert: (
    data: BillingSubscriptionItemInsertModel,
  ) => Effect.Effect<BillingSubscriptionItemModel, DatabaseError>;
  readonly findActive: (
    organizationId: OrganizationId,
    subscriptionId: BillingSubscriptionId,
    componentKey: BillingSubscriptionComponentKey,
  ) => Effect.Effect<BillingSubscriptionItemModel | undefined, DatabaseError>;
  readonly listForSubscription: (
    organizationId: OrganizationId,
    subscriptionId: BillingSubscriptionId,
  ) => Effect.Effect<ReadonlyArray<BillingSubscriptionItemModel>, DatabaseError>;
  readonly markRemoved: (
    organizationId: OrganizationId,
    id: BillingSubscriptionItemId,
    removedAt: DateTime.Utc,
  ) => Effect.Effect<BillingSubscriptionItemModel | undefined, DatabaseError>;
}

export class BillingSubscriptionItemRepository extends Context.Service<
  BillingSubscriptionItemRepository,
  BillingSubscriptionItemRepositoryService
>()("@namera-ai/database/BillingSubscriptionItemRepository") {
  static readonly layer: Layer.Layer<BillingSubscriptionItemRepository, never, Database> =
    Layer.effect(
      BillingSubscriptionItemRepository,
      Effect.gen(function* () {
        const database = yield* Database;
        return BillingSubscriptionItemRepository.of({
          insert: Effect.fn("database.billingSubscriptionItemRepository.insert")(function* (data) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .insert(billingSubscriptionItem)
              .values(Schema.encodeSync(BillingSubscriptionItemInsert)(data) as any)
              .returning();
            const row = rows[0];
            if (!row) return yield* Effect.die("Billing subscription item insert returned no row");
            return Schema.decodeUnknownSync(BillingSubscriptionItem)(row);
          }, mapRepositoryError),
          findActive: Effect.fn("database.billingSubscriptionItemRepository.findActive")(function* (
            organizationId,
            subscriptionId,
            componentKey,
          ) {
            const db = yield* transactionOrDatabase(database);
            const row = yield* db.query.billingSubscriptionItem.findFirst({
              where: {
                organizationId: { eq: organizationId },
                subscriptionId: { eq: subscriptionId },
                componentKey: { eq: componentKey },
                status: { eq: "active" },
              },
            });
            return row ? Schema.decodeUnknownSync(BillingSubscriptionItem)(row) : undefined;
          }, mapRepositoryError),
          listForSubscription: Effect.fn(
            "database.billingSubscriptionItemRepository.listForSubscription",
          )(function* (organizationId, subscriptionId) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(billingSubscriptionItem)
              .where(
                and(
                  eq(billingSubscriptionItem.organizationId, organizationId),
                  eq(billingSubscriptionItem.subscriptionId, subscriptionId),
                ),
              )
              .orderBy(
                asc(billingSubscriptionItem.componentKey),
                asc(billingSubscriptionItem.createdAt),
              );
            return Schema.decodeUnknownSync(Schema.Array(BillingSubscriptionItem))(rows);
          }, mapRepositoryError),
          markRemoved: Effect.fn("database.billingSubscriptionItemRepository.markRemoved")(
            function* (organizationId, id, removedAt) {
              const db = yield* transactionOrDatabase(database);
              const rows = yield* db
                .update(billingSubscriptionItem)
                .set({
                  status: "removed",
                  removedAt: Schema.encodeSync(Schema.DateTimeUtcFromDate)(removedAt),
                })
                .where(
                  and(
                    eq(billingSubscriptionItem.organizationId, organizationId),
                    eq(billingSubscriptionItem.id, id),
                    eq(billingSubscriptionItem.status, "active"),
                  ),
                )
                .returning();
              return rows[0]
                ? Schema.decodeUnknownSync(BillingSubscriptionItem)(rows[0])
                : undefined;
            },
            mapRepositoryError,
          ),
        });
      }),
    );
}
