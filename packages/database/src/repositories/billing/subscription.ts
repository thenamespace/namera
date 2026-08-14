// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError, OrganizationId } from "@namera-ai/protocol";
import { BillingSubscription, BillingSubscriptionInsert } from "@namera-ai/protocol/model";
import { and, desc, eq, inArray } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { billingSubscription } from "#/schema/index";

export interface BillingSubscriptionRepositoryService {
  readonly insert: (
    data: BillingSubscriptionInsert,
  ) => Effect.Effect<BillingSubscription, DatabaseError>;
  readonly findCurrent: (
    organizationId: OrganizationId,
  ) => Effect.Effect<BillingSubscription | undefined, DatabaseError>;
}

export class BillingSubscriptionRepository extends Context.Service<
  BillingSubscriptionRepository,
  BillingSubscriptionRepositoryService
>()("@namera-ai/database/BillingSubscriptionRepository") {
  static readonly layer: Layer.Layer<BillingSubscriptionRepository, never, Database> = Layer.effect(
    BillingSubscriptionRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return BillingSubscriptionRepository.of({
        insert: Effect.fn("database.billingSubscriptionRepository.insert")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(BillingSubscriptionInsert)(data);
          const rows = yield* db
            .insert(billingSubscription)
            .values(encoded as any)
            .returning();
          return Schema.decodeSync(BillingSubscription)(rows[0]!);
        }, mapRepositoryError),
        findCurrent: Effect.fn("database.billingSubscriptionRepository.findCurrent")(function* (
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(billingSubscription)
            .where(
              and(
                eq(billingSubscription.organizationId, organizationId),
                inArray(billingSubscription.status, ["trialing", "active", "past_due"]),
              ),
            )
            .orderBy(desc(billingSubscription.createdAt))
            .limit(1);
          return rows[0] ? Schema.decodeSync(BillingSubscription)(rows[0]) : undefined;
        }, mapRepositoryError),
      });
    }),
  );
}
