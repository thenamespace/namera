// oxlint-disable typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { BillingPeriodId, DatabaseError, OrganizationId } from "@namera-ai/protocol";
import {
  BillingMeterBalance,
  BillingMeterBalanceInsert,
  type BillingMeterBalance as BillingMeterBalanceModel,
  type BillingMeterBalanceInsert as BillingMeterBalanceInsertModel,
  type BillingMeterKey,
} from "@namera-ai/protocol/model";
import { and, asc, eq } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { billingMeterBalance } from "#/schema/index";

export interface BillingMeterBalanceRepositoryService {
  readonly insertMany: (
    data: ReadonlyArray<BillingMeterBalanceInsertModel>,
  ) => Effect.Effect<ReadonlyArray<BillingMeterBalanceModel>, DatabaseError>;
  readonly find: (
    organizationId: OrganizationId,
    periodId: BillingPeriodId,
    meterKey: BillingMeterKey,
  ) => Effect.Effect<BillingMeterBalanceModel | undefined, DatabaseError>;
  readonly findForUpdate: (
    organizationId: OrganizationId,
    periodId: BillingPeriodId,
    meterKey: BillingMeterKey,
  ) => Effect.Effect<BillingMeterBalanceModel | undefined, DatabaseError>;
  readonly listForPeriod: (
    organizationId: OrganizationId,
    periodId: BillingPeriodId,
  ) => Effect.Effect<ReadonlyArray<BillingMeterBalanceModel>, DatabaseError>;
}

export class BillingMeterBalanceRepository extends Context.Service<
  BillingMeterBalanceRepository,
  BillingMeterBalanceRepositoryService
>()("@namera-ai/database/BillingMeterBalanceRepository") {
  static readonly layer: Layer.Layer<BillingMeterBalanceRepository, never, Database> = Layer.effect(
    BillingMeterBalanceRepository,
    Effect.gen(function* () {
      const database = yield* Database;
      const find = (forUpdate: boolean) =>
        Effect.fn(
          forUpdate
            ? "database.billingMeterBalanceRepository.findForUpdate"
            : "database.billingMeterBalanceRepository.find",
        )(function* (
          organizationId: OrganizationId,
          periodId: BillingPeriodId,
          meterKey: BillingMeterKey,
        ) {
          const db = yield* transactionOrDatabase(database);
          const query = db
            .select()
            .from(billingMeterBalance)
            .where(
              and(
                eq(billingMeterBalance.organizationId, organizationId),
                eq(billingMeterBalance.periodId, periodId),
                eq(billingMeterBalance.meterKey, meterKey),
              ),
            )
            .limit(1);
          const rows = yield* forUpdate ? query.for("update") : query;
          return rows[0] ? Schema.decodeUnknownSync(BillingMeterBalance)(rows[0]) : undefined;
        }, mapRepositoryError);
      return BillingMeterBalanceRepository.of({
        insertMany: Effect.fn("database.billingMeterBalanceRepository.insertMany")(function* (
          data,
        ) {
          if (data.length === 0) return [];
          const db = yield* transactionOrDatabase(database);
          const encoded = data.map((item) => Schema.encodeSync(BillingMeterBalanceInsert)(item));
          const rows = yield* db
            .insert(billingMeterBalance)
            .values(encoded as any)
            .returning();
          return Schema.decodeUnknownSync(Schema.Array(BillingMeterBalance))(rows);
        }, mapRepositoryError),
        find: find(false),
        findForUpdate: find(true),
        listForPeriod: Effect.fn("database.billingMeterBalanceRepository.listForPeriod")(function* (
          organizationId,
          periodId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(billingMeterBalance)
            .where(
              and(
                eq(billingMeterBalance.organizationId, organizationId),
                eq(billingMeterBalance.periodId, periodId),
              ),
            )
            .orderBy(asc(billingMeterBalance.meterKey));
          return Schema.decodeUnknownSync(Schema.Array(BillingMeterBalance))(rows);
        }, mapRepositoryError),
      });
    }),
  );
}
