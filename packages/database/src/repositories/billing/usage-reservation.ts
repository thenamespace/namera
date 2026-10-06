// oxlint-disable typescript/no-explicit-any
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type {
  BillingPeriodId,
  BillingUsageReservationId,
  DatabaseError,
  OrganizationId,
} from "@namera-ai/protocol";
import {
  BillingUsageReservation,
  BillingUsageReservationInsert,
  type BillingMeterKey,
  type BillingUsageReservation as BillingUsageReservationModel,
  type BillingUsageReservationInsert as BillingUsageReservationInsertModel,
  type BillingUsageSourceType,
} from "@namera-ai/protocol/model";
import { and, asc, eq, inArray, lte, not, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { billingUsageReservation } from "#/schema/index";

const encodeDate = Schema.encodeSync(Schema.DateTimeUtcFromDate);
const providerSponsorship = sql`(
  ${eq(billingUsageReservation.meterKey, "gas-sponsorship")}
  AND ${inArray(billingUsageReservation.sourceType, ["execution-submission", "session-key-operation"])}
)`;

export interface BillingUsageReservationRepositoryService {
  readonly reserve: (
    data: BillingUsageReservationInsertModel,
  ) => Effect.Effect<
    { readonly reservation: BillingUsageReservationModel; readonly inserted: boolean },
    DatabaseError
  >;
  readonly findById: (
    organizationId: OrganizationId,
    id: BillingUsageReservationId,
  ) => Effect.Effect<BillingUsageReservationModel | undefined, DatabaseError>;
  readonly findBySource: (
    organizationId: OrganizationId,
    periodId: BillingPeriodId,
    meterKey: BillingMeterKey,
    sourceType: BillingUsageSourceType,
    sourceId: string,
  ) => Effect.Effect<BillingUsageReservationModel | undefined, DatabaseError>;
  readonly listBySource: (
    organizationId: OrganizationId,
    sourceType: BillingUsageSourceType,
    sourceId: string,
  ) => Effect.Effect<ReadonlyArray<BillingUsageReservationModel>, DatabaseError>;
  readonly findForUpdate: (
    organizationId: OrganizationId,
    id: BillingUsageReservationId,
  ) => Effect.Effect<BillingUsageReservationModel | undefined, DatabaseError>;
  readonly markSettled: (
    organizationId: OrganizationId,
    id: BillingUsageReservationId,
    settledAt: DateTime.Utc,
  ) => Effect.Effect<BillingUsageReservationModel | undefined, DatabaseError>;
  readonly markReleased: (
    organizationId: OrganizationId,
    id: BillingUsageReservationId,
    status: "released" | "expired",
    releasedAt: DateTime.Utc,
  ) => Effect.Effect<BillingUsageReservationModel | undefined, DatabaseError>;
  readonly deferExpiry: (
    organizationId: OrganizationId,
    id: BillingUsageReservationId,
    expiresAt: DateTime.Utc,
  ) => Effect.Effect<BillingUsageReservationModel | undefined, DatabaseError>;
  readonly claimExpired: (
    now: DateTime.Utc,
    limit: number,
  ) => Effect.Effect<ReadonlyArray<BillingUsageReservationModel>, DatabaseError>;
  readonly claimSponsorships: (
    now: DateTime.Utc,
    limit: number,
  ) => Effect.Effect<ReadonlyArray<BillingUsageReservationModel>, DatabaseError>;
  readonly sumActiveForMeter: (
    organizationId: OrganizationId,
    periodId: BillingPeriodId,
    meterKey: BillingMeterKey,
  ) => Effect.Effect<bigint, DatabaseError>;
}

export class BillingUsageReservationRepository extends Context.Service<
  BillingUsageReservationRepository,
  BillingUsageReservationRepositoryService
>()("@namera-ai/database/BillingUsageReservationRepository") {
  static readonly layer: Layer.Layer<BillingUsageReservationRepository, never, Database> =
    Layer.effect(
      BillingUsageReservationRepository,
      Effect.gen(function* () {
        const database = yield* Database;
        return BillingUsageReservationRepository.of({
          reserve: Effect.fn("database.billingUsageReservationRepository.reserve")(function* (
            data,
          ) {
            const db = yield* transactionOrDatabase(database);
            const inserted = yield* db
              .insert(billingUsageReservation)
              .values(Schema.encodeSync(BillingUsageReservationInsert)(data) as any)
              .onConflictDoNothing({
                target: [
                  billingUsageReservation.periodId,
                  billingUsageReservation.meterKey,
                  billingUsageReservation.sourceType,
                  billingUsageReservation.sourceId,
                ],
              })
              .returning();
            if (inserted[0])
              return {
                reservation: Schema.decodeUnknownSync(BillingUsageReservation)(inserted[0]),
                inserted: true,
              };
            const existing = yield* db.query.billingUsageReservation.findFirst({
              where: {
                periodId: { eq: data.periodId },
                meterKey: { eq: data.meterKey },
                sourceType: { eq: data.sourceType },
                sourceId: { eq: data.sourceId },
              },
            });
            if (!existing)
              return yield* Effect.die("Billing usage reservation conflict returned no row");
            return {
              reservation: Schema.decodeUnknownSync(BillingUsageReservation)(existing),
              inserted: false,
            };
          }, mapRepositoryError),
          findById: Effect.fn("database.billingUsageReservationRepository.findById")(function* (
            organizationId,
            id,
          ) {
            const db = yield* transactionOrDatabase(database);
            const row = yield* db.query.billingUsageReservation.findFirst({
              where: { organizationId: { eq: organizationId }, id: { eq: id } },
            });
            return row ? Schema.decodeUnknownSync(BillingUsageReservation)(row) : undefined;
          }, mapRepositoryError),
          findBySource: Effect.fn("database.billingUsageReservationRepository.findBySource")(
            function* (organizationId, periodId, meterKey, sourceType, sourceId) {
              const db = yield* transactionOrDatabase(database);
              const row = yield* db.query.billingUsageReservation.findFirst({
                where: {
                  organizationId: { eq: organizationId },
                  periodId: { eq: periodId },
                  meterKey: { eq: meterKey },
                  sourceType: { eq: sourceType },
                  sourceId: { eq: sourceId },
                },
              });
              return row ? Schema.decodeUnknownSync(BillingUsageReservation)(row) : undefined;
            },
            mapRepositoryError,
          ),
          listBySource: Effect.fn("database.billingUsageReservationRepository.listBySource")(
            function* (organizationId, sourceType, sourceId) {
              const db = yield* transactionOrDatabase(database);
              const rows = yield* db
                .select()
                .from(billingUsageReservation)
                .where(
                  and(
                    eq(billingUsageReservation.organizationId, organizationId),
                    eq(billingUsageReservation.sourceType, sourceType),
                    eq(billingUsageReservation.sourceId, sourceId),
                  ),
                )
                .orderBy(asc(billingUsageReservation.meterKey));
              return Schema.decodeUnknownSync(Schema.Array(BillingUsageReservation))(rows);
            },
            mapRepositoryError,
          ),
          findForUpdate: Effect.fn("database.billingUsageReservationRepository.findForUpdate")(
            function* (organizationId, id) {
              const db = yield* transactionOrDatabase(database);
              const rows = yield* db
                .select()
                .from(billingUsageReservation)
                .where(
                  and(
                    eq(billingUsageReservation.organizationId, organizationId),
                    eq(billingUsageReservation.id, id),
                  ),
                )
                .limit(1)
                .for("update");
              return rows[0]
                ? Schema.decodeUnknownSync(BillingUsageReservation)(rows[0])
                : undefined;
            },
            mapRepositoryError,
          ),
          markSettled: Effect.fn("database.billingUsageReservationRepository.markSettled")(
            function* (organizationId, id, settledAt) {
              const db = yield* transactionOrDatabase(database);
              const rows = yield* db
                .update(billingUsageReservation)
                .set({ status: "settled", settledAt: encodeDate(settledAt) })
                .where(
                  and(
                    eq(billingUsageReservation.organizationId, organizationId),
                    eq(billingUsageReservation.id, id),
                    eq(billingUsageReservation.status, "active"),
                  ),
                )
                .returning();
              return rows[0]
                ? Schema.decodeUnknownSync(BillingUsageReservation)(rows[0])
                : undefined;
            },
            mapRepositoryError,
          ),
          markReleased: Effect.fn("database.billingUsageReservationRepository.markReleased")(
            function* (organizationId, id, status, releasedAt) {
              const db = yield* transactionOrDatabase(database);
              const rows = yield* db
                .update(billingUsageReservation)
                .set({ status, releasedAt: encodeDate(releasedAt) })
                .where(
                  and(
                    eq(billingUsageReservation.organizationId, organizationId),
                    eq(billingUsageReservation.id, id),
                    eq(billingUsageReservation.status, "active"),
                  ),
                )
                .returning();
              return rows[0]
                ? Schema.decodeUnknownSync(BillingUsageReservation)(rows[0])
                : undefined;
            },
            mapRepositoryError,
          ),
          deferExpiry: Effect.fn("database.billingUsageReservationRepository.deferExpiry")(
            function* (organizationId, id, expiresAt) {
              const db = yield* transactionOrDatabase(database);
              const rows = yield* db
                .update(billingUsageReservation)
                .set({ expiresAt: encodeDate(expiresAt) })
                .where(
                  and(
                    eq(billingUsageReservation.organizationId, organizationId),
                    eq(billingUsageReservation.id, id),
                    eq(billingUsageReservation.status, "active"),
                  ),
                )
                .returning();
              return rows[0]
                ? Schema.decodeUnknownSync(BillingUsageReservation)(rows[0])
                : undefined;
            },
            mapRepositoryError,
          ),
          claimExpired: Effect.fn("database.billingUsageReservationRepository.claimExpired")(
            function* (now, limit) {
              const db = yield* transactionOrDatabase(database);
              const rows = yield* db
                .select()
                .from(billingUsageReservation)
                .where(
                  and(
                    eq(billingUsageReservation.status, "active"),
                    lte(billingUsageReservation.expiresAt, encodeDate(now)),
                    not(providerSponsorship),
                  ),
                )
                .orderBy(asc(billingUsageReservation.expiresAt), asc(billingUsageReservation.id))
                .limit(Math.min(Math.max(Math.trunc(limit), 1), 100))
                .for("update", { skipLocked: true });
              return Schema.decodeUnknownSync(Schema.Array(BillingUsageReservation))(rows);
            },
            mapRepositoryError,
          ),
          claimSponsorships: Effect.fn(
            "database.billingUsageReservationRepository.claimSponsorships",
          )(function* (now, limit) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(billingUsageReservation)
              .where(
                and(
                  eq(billingUsageReservation.status, "active"),
                  lte(billingUsageReservation.expiresAt, encodeDate(now)),
                  providerSponsorship,
                ),
              )
              .orderBy(asc(billingUsageReservation.expiresAt), asc(billingUsageReservation.id))
              .limit(Math.min(Math.max(Math.trunc(limit), 1), 100))
              .for("update", { skipLocked: true });
            return Schema.decodeUnknownSync(Schema.Array(BillingUsageReservation))(rows);
          }, mapRepositoryError),
          sumActiveForMeter: Effect.fn(
            "database.billingUsageReservationRepository.sumActiveForMeter",
          )(function* (organizationId, periodId, meterKey) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select({ amount: sql<string>`coalesce(sum(${billingUsageReservation.amount}), 0)` })
              .from(billingUsageReservation)
              .where(
                and(
                  eq(billingUsageReservation.organizationId, organizationId),
                  eq(billingUsageReservation.periodId, periodId),
                  eq(billingUsageReservation.meterKey, meterKey),
                  eq(billingUsageReservation.status, "active"),
                ),
              );
            return BigInt(rows[0]?.amount ?? "0");
          }, mapRepositoryError),
        });
      }),
    );
}
