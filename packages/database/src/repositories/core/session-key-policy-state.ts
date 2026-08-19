// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema } from "effect";

import type {
  DatabaseError,
  OrganizationId,
  PolicyId,
  SessionKeyId,
  SessionKeyPolicyStateId,
} from "@namera-ai/protocol";
import {
  SessionKeyPolicyState,
  SessionKeyPolicyStateInsert,
  type SessionKeyPolicyState as SessionKeyPolicyStateModel,
  type SessionKeyPolicyStateInsert as SessionKeyPolicyStateInsertModel,
} from "@namera-ai/protocol/model";
import { and, asc, eq, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { sessionKeyPolicyState } from "#/schema/index";

export interface SessionKeyPolicyStateRepositoryService {
  readonly insertMany: (
    data: ReadonlyArray<SessionKeyPolicyStateInsertModel>,
  ) => Effect.Effect<ReadonlyArray<SessionKeyPolicyStateModel>, DatabaseError>;
  readonly insertManyIfMissing: (
    data: ReadonlyArray<SessionKeyPolicyStateInsertModel>,
  ) => Effect.Effect<ReadonlyArray<SessionKeyPolicyStateModel>, DatabaseError>;
  readonly findForPolicy: (
    organizationId: OrganizationId,
    sessionKeyId: SessionKeyId,
    policyId: PolicyId,
  ) => Effect.Effect<ReadonlyArray<SessionKeyPolicyStateModel>, DatabaseError>;
  readonly findForPolicyForUpdate: (
    organizationId: OrganizationId,
    sessionKeyId: SessionKeyId,
    policyId: PolicyId,
  ) => Effect.Effect<ReadonlyArray<SessionKeyPolicyStateModel>, DatabaseError>;
  readonly findForScopesForUpdate: (
    organizationId: OrganizationId,
    sessionKeyId: SessionKeyId,
    scopes: ReadonlyArray<{ readonly policyId: PolicyId; readonly stateKey: string }>,
  ) => Effect.Effect<ReadonlyArray<SessionKeyPolicyStateModel>, DatabaseError>;
  readonly update: (input: {
    readonly id: SessionKeyPolicyStateId;
    readonly organizationId: OrganizationId;
    readonly expectedRevision: number;
    readonly stateVersion: number;
    readonly data: SessionKeyPolicyStateModel["data"];
  }) => Effect.Effect<SessionKeyPolicyStateModel | undefined, DatabaseError>;
}

export class SessionKeyPolicyStateRepository extends Context.Service<
  SessionKeyPolicyStateRepository,
  SessionKeyPolicyStateRepositoryService
>()("@namera-ai/database/SessionKeyPolicyStateRepository") {
  static readonly layer: Layer.Layer<SessionKeyPolicyStateRepository, never, Database> =
    Layer.effect(
      SessionKeyPolicyStateRepository,
      Effect.gen(function* () {
        const database = yield* Database;

        return SessionKeyPolicyStateRepository.of({
          insertMany: Effect.fn("database.sessionKeyPolicyStateRepository.insertMany")(function* (
            data,
          ) {
            if (data.length === 0) return [];
            const db = yield* transactionOrDatabase(database);
            const encoded = data.map((item) =>
              Schema.encodeSync(SessionKeyPolicyStateInsert)(item),
            );
            const rows = yield* db
              .insert(sessionKeyPolicyState)
              .values(encoded as any)
              .returning();
            return rows.map((row) => Schema.decodeSync(SessionKeyPolicyState)(row as any));
          }, mapRepositoryError),
          insertManyIfMissing: Effect.fn(
            "database.sessionKeyPolicyStateRepository.insertManyIfMissing",
          )(function* (data) {
            if (data.length === 0) return [];
            const db = yield* transactionOrDatabase(database);
            const encoded = data.map((item) =>
              Schema.encodeSync(SessionKeyPolicyStateInsert)(item),
            );
            const rows = yield* db
              .insert(sessionKeyPolicyState)
              .values(encoded as any)
              .onConflictDoNothing({
                target: [
                  sessionKeyPolicyState.organizationId,
                  sessionKeyPolicyState.sessionKeyId,
                  sessionKeyPolicyState.policyId,
                  sessionKeyPolicyState.stateKey,
                ],
              })
              .returning();
            return rows.map((row) => Schema.decodeSync(SessionKeyPolicyState)(row as any));
          }, mapRepositoryError),
          findForPolicy: Effect.fn("database.sessionKeyPolicyStateRepository.findForPolicy")(
            function* (organizationId, sessionKeyId, policyId) {
              const db = yield* transactionOrDatabase(database);
              const rows = yield* db
                .select()
                .from(sessionKeyPolicyState)
                .where(
                  and(
                    eq(sessionKeyPolicyState.organizationId, organizationId),
                    eq(sessionKeyPolicyState.sessionKeyId, sessionKeyId),
                    eq(sessionKeyPolicyState.policyId, policyId),
                  ),
                )
                .orderBy(asc(sessionKeyPolicyState.stateKey));
              return rows.map((row) => Schema.decodeSync(SessionKeyPolicyState)(row as any));
            },
            mapRepositoryError,
          ),
          findForPolicyForUpdate: Effect.fn(
            "database.sessionKeyPolicyStateRepository.findForPolicyForUpdate",
          )(function* (organizationId, sessionKeyId, policyId) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(sessionKeyPolicyState)
              .where(
                and(
                  eq(sessionKeyPolicyState.organizationId, organizationId),
                  eq(sessionKeyPolicyState.sessionKeyId, sessionKeyId),
                  eq(sessionKeyPolicyState.policyId, policyId),
                ),
              )
              .orderBy(asc(sessionKeyPolicyState.stateKey))
              .for("update");
            return rows.map((row) => Schema.decodeSync(SessionKeyPolicyState)(row as any));
          }, mapRepositoryError),
          findForScopesForUpdate: Effect.fn(
            "database.sessionKeyPolicyStateRepository.findForScopesForUpdate",
          )(function* (organizationId, sessionKeyId, scopes) {
            if (scopes.length === 0) return [];
            const db = yield* transactionOrDatabase(database);
            const rows = yield* Effect.forEach(scopes, (scope) =>
              db
                .select()
                .from(sessionKeyPolicyState)
                .where(
                  and(
                    eq(sessionKeyPolicyState.organizationId, organizationId),
                    eq(sessionKeyPolicyState.sessionKeyId, sessionKeyId),
                    eq(sessionKeyPolicyState.policyId, scope.policyId),
                    eq(sessionKeyPolicyState.stateKey, scope.stateKey),
                  ),
                )
                .limit(1)
                .for("update"),
            );
            return rows.flat().map((row) => Schema.decodeSync(SessionKeyPolicyState)(row as any));
          }, mapRepositoryError),
          update: Effect.fn("database.sessionKeyPolicyStateRepository.update")(function* ({
            id,
            organizationId,
            expectedRevision,
            stateVersion,
            data,
          }) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .update(sessionKeyPolicyState)
              .set({
                stateVersion,
                data,
                revision: sql`${sessionKeyPolicyState.revision} + 1`,
              })
              .where(
                and(
                  eq(sessionKeyPolicyState.id, id),
                  eq(sessionKeyPolicyState.organizationId, organizationId),
                  eq(sessionKeyPolicyState.revision, expectedRevision),
                ),
              )
              .returning();
            return rows[0] ? Schema.decodeSync(SessionKeyPolicyState)(rows[0] as any) : undefined;
          }, mapRepositoryError),
        });
      }),
    );
}
