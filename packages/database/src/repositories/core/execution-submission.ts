// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type {
  ActorId,
  DatabaseError,
  ExecutionSubmissionId,
  OrganizationId,
  EvmSignedExecution as EvmSignedExecutionModel,
} from "@namera-ai/protocol";
import { EvmSignedExecution } from "@namera-ai/protocol";
import {
  ExecutionSubmission,
  ExecutionSubmissionInsert,
  EvmExecutionSubmissionData,
  type ExecutionSubmission as ExecutionSubmissionModel,
  type ExecutionSubmissionInsert as ExecutionSubmissionInsertModel,
} from "@namera-ai/protocol/model";
import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { executionSubmission } from "#/schema/index";

export interface ExecutionSubmissionRepositoryService {
  readonly acceptSignature: (input: {
    readonly id: ExecutionSubmissionId;
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly requestHash: string;
    readonly signed: EvmSignedExecutionModel;
    readonly now: DateTime.Utc;
    readonly nextReconcileAt: DateTime.Utc;
  }) => Effect.Effect<ExecutionSubmissionModel | undefined, DatabaseError>;
  readonly insert: (
    data: ExecutionSubmissionInsertModel,
  ) => Effect.Effect<
    { readonly submission: ExecutionSubmissionModel; readonly inserted: boolean },
    DatabaseError
  >;
  readonly findById: (
    id: ExecutionSubmissionId,
    organizationId: OrganizationId,
  ) => Effect.Effect<ExecutionSubmissionModel | undefined, DatabaseError>;
  readonly findByIdForUpdate: (
    id: ExecutionSubmissionId,
    organizationId: OrganizationId,
    skipLocked?: boolean,
  ) => Effect.Effect<ExecutionSubmissionModel | undefined, DatabaseError>;
  readonly findByIdForActor: (
    id: ExecutionSubmissionId,
    organizationId: OrganizationId,
    actorId: ActorId,
  ) => Effect.Effect<ExecutionSubmissionModel | undefined, DatabaseError>;
  readonly findByActorAndIdempotencyKey: (
    organizationId: OrganizationId,
    actorId: ActorId,
    idempotencyKey: string,
  ) => Effect.Effect<ExecutionSubmissionModel | undefined, DatabaseError>;
  readonly markPrepared: (input: {
    readonly id: ExecutionSubmissionId;
    readonly organizationId: OrganizationId;
    readonly data: ExecutionSubmissionModel["data"];
    readonly leaseToken?: string;
    readonly nextReconcileAt: DateTime.Utc;
  }) => Effect.Effect<ExecutionSubmissionModel | undefined, DatabaseError>;
  readonly markSubmitted: (input: {
    readonly id: ExecutionSubmissionId;
    readonly organizationId: OrganizationId;
    readonly submittedAt: DateTime.Utc;
    readonly nextReconcileAt: DateTime.Utc;
    readonly leaseToken?: string;
  }) => Effect.Effect<ExecutionSubmissionModel | undefined, DatabaseError>;
  readonly markConfirmed: (input: {
    readonly id: ExecutionSubmissionId;
    readonly organizationId: OrganizationId;
    readonly confirmedAt: DateTime.Utc;
    readonly leaseToken?: string;
  }) => Effect.Effect<ExecutionSubmissionModel | undefined, DatabaseError>;
  readonly markFailed: (input: {
    readonly id: ExecutionSubmissionId;
    readonly organizationId: OrganizationId;
    readonly failedAt: DateTime.Utc;
    readonly leaseToken?: string;
  }) => Effect.Effect<ExecutionSubmissionModel | undefined, DatabaseError>;
  readonly claimForReconciliation: (input: {
    readonly now: DateTime.Utc;
    readonly leaseToken: string;
    readonly leaseExpiresAt: DateTime.Utc;
    readonly limit: number;
  }) => Effect.Effect<ReadonlyArray<ExecutionSubmissionModel>, DatabaseError>;
  readonly releaseLease: (input: {
    readonly id: ExecutionSubmissionId;
    readonly organizationId: OrganizationId;
    readonly leaseToken: string;
    readonly nextReconcileAt: DateTime.Utc;
  }) => Effect.Effect<ExecutionSubmissionModel | undefined, DatabaseError>;
}

const encodeDate = Schema.encodeSync(Schema.DateTimeUtcFromDate);

export class ExecutionSubmissionRepository extends Context.Service<
  ExecutionSubmissionRepository,
  ExecutionSubmissionRepositoryService
>()("@namera-ai/database/ExecutionSubmissionRepository") {
  static readonly layer: Layer.Layer<ExecutionSubmissionRepository, never, Database> = Layer.effect(
    ExecutionSubmissionRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return ExecutionSubmissionRepository.of({
        acceptSignature: Effect.fn("database.executionSubmission.acceptSignature")(function* (
          input,
        ) {
          const db = yield* transactionOrDatabase(database);
          const signed = Schema.encodeSync(EvmSignedExecution)(input.signed);
          const rows = yield* db
            .update(executionSubmission)
            .set({
              status: "prepared",
              data: sql`jsonb_set(${executionSubmission.data}, '{signedExecution}', ${JSON.stringify(signed)}::jsonb)`,
              leaseToken: null,
              leaseExpiresAt: encodeDate(input.nextReconcileAt),
            })
            .where(
              and(
                eq(executionSubmission.id, input.id),
                eq(executionSubmission.organizationId, input.organizationId),
                eq(executionSubmission.actorId, input.actorId),
                eq(executionSubmission.requestHash, input.requestHash),
                eq(executionSubmission.status, "reserved"),
                gt(executionSubmission.expiresAt, encodeDate(input.now)),
                sql`${executionSubmission.data}->'signedExecution' = 'null'::jsonb`,
              ),
            )
            .returning();
          return rows[0] === undefined
            ? undefined
            : Schema.decodeSync(ExecutionSubmission)(rows[0]);
        }, mapRepositoryError),
        insert: Effect.fn("database.executionSubmissionRepository.insert")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(ExecutionSubmissionInsert)(data);
          const rows = yield* db
            .insert(executionSubmission)
            .values(encoded as any)
            .onConflictDoNothing({
              target: [
                executionSubmission.organizationId,
                executionSubmission.actorId,
                executionSubmission.idempotencyKey,
              ],
            })
            .returning();
          if (rows[0]) {
            return {
              submission: Schema.decodeSync(ExecutionSubmission)(rows[0] as any),
              inserted: true,
            };
          }

          const existing = yield* db.query.executionSubmission.findFirst({
            where: {
              organizationId: { eq: data.organizationId },
              actorId: { eq: data.actorId },
              idempotencyKey: { eq: data.idempotencyKey },
            },
          });
          return {
            submission: Schema.decodeSync(ExecutionSubmission)(existing! as any),
            inserted: false,
          };
        }, mapRepositoryError),
        findById: Effect.fn("database.executionSubmissionRepository.findById")(function* (
          id,
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.executionSubmission.findFirst({
            where: {
              id: { eq: id },
              organizationId: { eq: organizationId },
            },
          });
          return row === undefined ? undefined : Schema.decodeSync(ExecutionSubmission)(row as any);
        }, mapRepositoryError),
        findByIdForUpdate: Effect.fn("database.executionSubmissionRepository.findByIdForUpdate")(
          function* (id, organizationId, skipLocked = false) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(executionSubmission)
              .where(
                and(
                  eq(executionSubmission.id, id),
                  eq(executionSubmission.organizationId, organizationId),
                ),
              )
              .limit(1)
              .for("update", skipLocked ? { skipLocked: true } : {});
            return rows[0] ? Schema.decodeSync(ExecutionSubmission)(rows[0] as any) : undefined;
          },
          mapRepositoryError,
        ),
        findByIdForActor: Effect.fn("database.executionSubmissionRepository.findByIdForActor")(
          function* (id, organizationId, actorId) {
            const db = yield* transactionOrDatabase(database);
            const row = yield* db.query.executionSubmission.findFirst({
              where: {
                id: { eq: id },
                organizationId: { eq: organizationId },
                actorId: { eq: actorId },
              },
            });
            return row === undefined
              ? undefined
              : Schema.decodeSync(ExecutionSubmission)(row as any);
          },
          mapRepositoryError,
        ),
        findByActorAndIdempotencyKey: Effect.fn(
          "database.executionSubmissionRepository.findByActorAndIdempotencyKey",
        )(function* (organizationId, actorId, idempotencyKey) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.executionSubmission.findFirst({
            where: {
              organizationId: { eq: organizationId },
              actorId: { eq: actorId },
              idempotencyKey: { eq: idempotencyKey },
            },
          });
          return row === undefined ? undefined : Schema.decodeSync(ExecutionSubmission)(row as any);
        }, mapRepositoryError),
        markPrepared: Effect.fn("database.executionSubmissionRepository.markPrepared")(function* ({
          id,
          organizationId,
          data,
          leaseToken,
          nextReconcileAt,
        }) {
          const db = yield* transactionOrDatabase(database);
          const encodedData = Schema.encodeSync(EvmExecutionSubmissionData)(data);
          const rows = yield* db
            .update(executionSubmission)
            .set({
              status: "prepared",
              data: encodedData as any,
              leaseExpiresAt: encodeDate(nextReconcileAt),
            })
            .where(
              and(
                eq(executionSubmission.id, id),
                eq(executionSubmission.organizationId, organizationId),
                eq(executionSubmission.status, "reserved"),
                leaseToken === undefined
                  ? undefined
                  : eq(executionSubmission.leaseToken, leaseToken),
              ),
            )
            .returning();
          return rows[0] ? Schema.decodeSync(ExecutionSubmission)(rows[0] as any) : undefined;
        }, mapRepositoryError),
        markSubmitted: Effect.fn("database.executionSubmissionRepository.markSubmitted")(
          function* ({ id, organizationId, submittedAt, nextReconcileAt, leaseToken }) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .update(executionSubmission)
              .set({
                status: "submitted",
                submittedAt: encodeDate(submittedAt),
                leaseToken: null,
                leaseExpiresAt: encodeDate(nextReconcileAt),
              })
              .where(
                and(
                  eq(executionSubmission.id, id),
                  eq(executionSubmission.organizationId, organizationId),
                  eq(executionSubmission.status, "prepared"),
                  leaseToken === undefined
                    ? undefined
                    : eq(executionSubmission.leaseToken, leaseToken),
                ),
              )
              .returning();
            return rows[0] ? Schema.decodeSync(ExecutionSubmission)(rows[0] as any) : undefined;
          },
          mapRepositoryError,
        ),
        markConfirmed: Effect.fn("database.executionSubmissionRepository.markConfirmed")(
          function* ({ id, organizationId, confirmedAt, leaseToken }) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .update(executionSubmission)
              .set({
                status: "confirmed",
                confirmedAt: encodeDate(confirmedAt),
                leaseToken: null,
                leaseExpiresAt: null,
              })
              .where(
                and(
                  eq(executionSubmission.id, id),
                  eq(executionSubmission.organizationId, organizationId),
                  inArray(executionSubmission.status, ["prepared", "submitted"]),
                  leaseToken === undefined
                    ? undefined
                    : eq(executionSubmission.leaseToken, leaseToken),
                ),
              )
              .returning();
            return rows[0] ? Schema.decodeSync(ExecutionSubmission)(rows[0] as any) : undefined;
          },
          mapRepositoryError,
        ),
        markFailed: Effect.fn("database.executionSubmissionRepository.markFailed")(function* ({
          id,
          organizationId,
          failedAt,
          leaseToken,
        }) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(executionSubmission)
            .set({
              status: "failed",
              failedAt: encodeDate(failedAt),
              leaseToken: null,
              leaseExpiresAt: null,
            })
            .where(
              and(
                eq(executionSubmission.id, id),
                eq(executionSubmission.organizationId, organizationId),
                inArray(executionSubmission.status, ["reserved", "prepared", "submitted"]),
                leaseToken === undefined
                  ? undefined
                  : eq(executionSubmission.leaseToken, leaseToken),
              ),
            )
            .returning();
          return rows[0] ? Schema.decodeSync(ExecutionSubmission)(rows[0] as any) : undefined;
        }, mapRepositoryError),
        claimForReconciliation: Effect.fn(
          "database.executionSubmissionRepository.claimForReconciliation",
        )(function* ({ now, leaseToken, leaseExpiresAt, limit }) {
          const db = yield* transactionOrDatabase(database);
          const encodedNow = encodeDate(now);
          const batchSize = Math.min(Math.max(Math.trunc(limit), 1), 100);
          const candidate = db
            .select({ id: executionSubmission.id })
            .from(executionSubmission)
            .where(
              and(
                or(
                  inArray(executionSubmission.status, ["prepared", "submitted"]),
                  and(
                    eq(executionSubmission.status, "reserved"),
                    lte(executionSubmission.expiresAt, encodedNow),
                  ),
                ),
                or(
                  isNull(executionSubmission.leaseExpiresAt),
                  lte(executionSubmission.leaseExpiresAt, encodedNow),
                ),
              ),
            )
            .orderBy(asc(executionSubmission.leaseExpiresAt), asc(executionSubmission.createdAt))
            .limit(batchSize)
            .for("update", { skipLocked: true });
          const rows = yield* db
            .update(executionSubmission)
            .set({
              leaseToken,
              leaseExpiresAt: encodeDate(leaseExpiresAt),
            })
            .where(inArray(executionSubmission.id, candidate))
            .returning();
          return rows.map((row) => Schema.decodeSync(ExecutionSubmission)(row as any));
        }, mapRepositoryError),
        releaseLease: Effect.fn("database.executionSubmissionRepository.releaseLease")(function* ({
          id,
          organizationId,
          leaseToken,
          nextReconcileAt,
        }) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(executionSubmission)
            .set({
              leaseToken: null,
              leaseExpiresAt: encodeDate(nextReconcileAt),
            })
            .where(
              and(
                eq(executionSubmission.id, id),
                eq(executionSubmission.organizationId, organizationId),
                eq(executionSubmission.leaseToken, leaseToken),
                inArray(executionSubmission.status, ["reserved", "prepared", "submitted"]),
              ),
            )
            .returning();
          return rows[0] ? Schema.decodeSync(ExecutionSubmission)(rows[0] as any) : undefined;
        }, mapRepositoryError),
      });
    }),
  );
}
