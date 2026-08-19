// oxlint-disable typescript/no-explicit-any
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError, ExecutionSubmissionId, OrganizationId } from "@namera-ai/protocol";
import {
  type PolicyOperationReference,
  SessionKeyPolicyReservation,
  SessionKeyPolicyReservationInsert,
  type SessionKeyPolicyReservation as SessionKeyPolicyReservationModel,
  type SessionKeyPolicyReservationInsert as SessionKeyPolicyReservationInsertModel,
} from "@namera-ai/protocol/model";
import { and, asc, eq, inArray } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { sessionKeyPolicyReservation } from "#/schema/index";

export interface SessionKeyPolicyReservationRepositoryService {
  readonly insertMany: (
    data: ReadonlyArray<SessionKeyPolicyReservationInsertModel>,
  ) => Effect.Effect<ReadonlyArray<SessionKeyPolicyReservationModel>, DatabaseError>;
  readonly findForOperation: (
    organizationId: OrganizationId,
    operation: PolicyOperationReference,
  ) => Effect.Effect<ReadonlyArray<SessionKeyPolicyReservationModel>, DatabaseError>;
  readonly markSubmittedForExecution: (
    organizationId: OrganizationId,
    executionSubmissionId: ExecutionSubmissionId,
    submittedAt: DateTime.Utc,
  ) => Effect.Effect<ReadonlyArray<SessionKeyPolicyReservationModel>, DatabaseError>;
  readonly markSettled: (
    organizationId: OrganizationId,
    operation: PolicyOperationReference,
    settledAt: DateTime.Utc,
  ) => Effect.Effect<ReadonlyArray<SessionKeyPolicyReservationModel>, DatabaseError>;
  readonly markReleased: (
    organizationId: OrganizationId,
    operation: PolicyOperationReference,
    releasedAt: DateTime.Utc,
  ) => Effect.Effect<ReadonlyArray<SessionKeyPolicyReservationModel>, DatabaseError>;
}

const encodeDate = Schema.encodeSync(Schema.DateTimeUtcFromDate);

const operationPredicate = (operation: PolicyOperationReference) =>
  operation.type === "execution"
    ? eq(sessionKeyPolicyReservation.executionSubmissionId, operation.id)
    : eq(sessionKeyPolicyReservation.signatureOperationId, operation.id);

export class SessionKeyPolicyReservationRepository extends Context.Service<
  SessionKeyPolicyReservationRepository,
  SessionKeyPolicyReservationRepositoryService
>()("@namera-ai/database/SessionKeyPolicyReservationRepository") {
  static readonly layer: Layer.Layer<SessionKeyPolicyReservationRepository, never, Database> =
    Layer.effect(
      SessionKeyPolicyReservationRepository,
      Effect.gen(function* () {
        const database = yield* Database;

        return SessionKeyPolicyReservationRepository.of({
          insertMany: Effect.fn("database.sessionKeyPolicyReservationRepository.insertMany")(
            function* (data) {
              if (data.length === 0) return [];
              const db = yield* transactionOrDatabase(database);
              const encoded = data.map((item) =>
                Schema.encodeSync(SessionKeyPolicyReservationInsert)(item),
              );
              const rows = yield* db
                .insert(sessionKeyPolicyReservation)
                .values(encoded as any)
                .returning();
              return rows.map((row) => Schema.decodeSync(SessionKeyPolicyReservation)(row as any));
            },
            mapRepositoryError,
          ),
          findForOperation: Effect.fn(
            "database.sessionKeyPolicyReservationRepository.findForOperation",
          )(function* (organizationId, operation) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(sessionKeyPolicyReservation)
              .where(
                and(
                  eq(sessionKeyPolicyReservation.organizationId, organizationId),
                  operationPredicate(operation),
                ),
              )
              .orderBy(
                asc(sessionKeyPolicyReservation.policyId),
                asc(sessionKeyPolicyReservation.stateKey),
              );
            return rows.map((row) => Schema.decodeSync(SessionKeyPolicyReservation)(row as any));
          }, mapRepositoryError),
          markSubmittedForExecution: Effect.fn(
            "database.sessionKeyPolicyReservationRepository.markSubmittedForExecution",
          )(function* (organizationId, executionSubmissionId, submittedAt) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .update(sessionKeyPolicyReservation)
              .set({
                status: "submitted",
                submittedAt: encodeDate(submittedAt),
              })
              .where(
                and(
                  eq(sessionKeyPolicyReservation.organizationId, organizationId),
                  eq(sessionKeyPolicyReservation.executionSubmissionId, executionSubmissionId),
                  eq(sessionKeyPolicyReservation.status, "reserved"),
                ),
              )
              .returning();
            return rows.map((row) => Schema.decodeSync(SessionKeyPolicyReservation)(row as any));
          }, mapRepositoryError),
          markSettled: Effect.fn("database.sessionKeyPolicyReservationRepository.markSettled")(
            function* (organizationId, operation, settledAt) {
              const db = yield* transactionOrDatabase(database);
              const rows = yield* db
                .update(sessionKeyPolicyReservation)
                .set({
                  status: "settled",
                  settledAt: encodeDate(settledAt),
                })
                .where(
                  and(
                    eq(sessionKeyPolicyReservation.organizationId, organizationId),
                    operationPredicate(operation),
                    inArray(sessionKeyPolicyReservation.status, ["reserved", "submitted"]),
                  ),
                )
                .returning();
              return rows.map((row) => Schema.decodeSync(SessionKeyPolicyReservation)(row as any));
            },
            mapRepositoryError,
          ),
          markReleased: Effect.fn("database.sessionKeyPolicyReservationRepository.markReleased")(
            function* (organizationId, operation, releasedAt) {
              const db = yield* transactionOrDatabase(database);
              const rows = yield* db
                .update(sessionKeyPolicyReservation)
                .set({
                  status: "released",
                  releasedAt: encodeDate(releasedAt),
                })
                .where(
                  and(
                    eq(sessionKeyPolicyReservation.organizationId, organizationId),
                    operationPredicate(operation),
                    inArray(sessionKeyPolicyReservation.status, ["reserved", "submitted"]),
                  ),
                )
                .returning();
              return rows.map((row) => Schema.decodeSync(SessionKeyPolicyReservation)(row as any));
            },
            mapRepositoryError,
          ),
        });
      }),
    );
}
