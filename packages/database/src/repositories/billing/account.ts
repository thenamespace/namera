// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError, OrganizationId } from "@namera-ai/protocol";
import { BillingAccount, BillingAccountInsert } from "@namera-ai/protocol/model";
import { eq } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { billingAccount } from "#/schema/index";

export interface BillingAccountRepositoryService {
  readonly insert: (data: BillingAccountInsert) => Effect.Effect<BillingAccount, DatabaseError>;
  readonly findByOrganizationId: (
    organizationId: OrganizationId,
  ) => Effect.Effect<BillingAccount | undefined, DatabaseError>;
  readonly lockByOrganizationId: (
    organizationId: OrganizationId,
  ) => Effect.Effect<BillingAccount | undefined, DatabaseError>;
}

export class BillingAccountRepository extends Context.Service<
  BillingAccountRepository,
  BillingAccountRepositoryService
>()("@namera-ai/database/BillingAccountRepository") {
  static readonly layer: Layer.Layer<BillingAccountRepository, never, Database> = Layer.effect(
    BillingAccountRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return BillingAccountRepository.of({
        insert: Effect.fn("BillingAccountRepository.insert")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(BillingAccountInsert)(data);
          const rows = yield* db
            .insert(billingAccount)
            .values(encoded as any)
            .returning();
          return Schema.decodeSync(BillingAccount)(rows[0]!);
        }, mapToDatabaseError),
        findByOrganizationId: Effect.fn("BillingAccountRepository.findByOrganizationId")(function* (
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.billingAccount.findFirst({
            where: { organizationId: { eq: organizationId } },
          });
          return row ? Schema.decodeSync(BillingAccount)(row) : undefined;
        }, mapToDatabaseError),
        lockByOrganizationId: Effect.fn("BillingAccountRepository.lockByOrganizationId")(function* (
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(billingAccount)
            .where(eq(billingAccount.organizationId, organizationId))
            .for("update");
          return rows[0] ? Schema.decodeSync(BillingAccount)(rows[0]) : undefined;
        }, mapToDatabaseError),
      });
    }),
  );
}
