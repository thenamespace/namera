// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema } from "effect";

import type {
  DatabaseError,
  ExecutionId,
  ExecutionSubmissionId,
  OrganizationId,
} from "@namera-ai/protocol";
import {
  Execution,
  ExecutionInsert,
  type Execution as ExecutionModel,
  type ExecutionInsert as ExecutionInsertModel,
} from "@namera-ai/protocol/model";
import { and, desc, eq, lt, or } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { execution } from "#/schema/index";

export interface ExecutionRepositoryService {
  readonly insert: (data: ExecutionInsertModel) => Effect.Effect<ExecutionModel, DatabaseError>;
  readonly findById: (
    id: ExecutionId,
    organizationId: OrganizationId,
  ) => Effect.Effect<ExecutionModel | undefined, DatabaseError>;
  readonly findBySubmissionId: (
    executionSubmissionId: ExecutionSubmissionId,
    organizationId: OrganizationId,
  ) => Effect.Effect<ExecutionModel | undefined, DatabaseError>;
  readonly findForOrganization: (input: {
    readonly organizationId: OrganizationId;
    readonly cursor?: ExecutionId;
    readonly limit: number;
  }) => Effect.Effect<ReadonlyArray<ExecutionModel>, DatabaseError>;
}

export class ExecutionRepository extends Context.Service<
  ExecutionRepository,
  ExecutionRepositoryService
>()("@namera-ai/database/ExecutionRepository") {
  static readonly layer: Layer.Layer<ExecutionRepository, never, Database> = Layer.effect(
    ExecutionRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return ExecutionRepository.of({
        insert: Effect.fn("database.executionRepository.insert")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(ExecutionInsert)(data);
          const rows = yield* db
            .insert(execution)
            .values(encoded as any)
            .returning();
          return Schema.decodeSync(Execution)(rows[0]! as any);
        }, mapRepositoryError),
        findById: Effect.fn("database.executionRepository.findById")(function* (
          id,
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(execution)
            .where(and(eq(execution.id, id), eq(execution.organizationId, organizationId)))
            .limit(1);
          return rows[0] ? Schema.decodeSync(Execution)(rows[0] as any) : undefined;
        }, mapRepositoryError),
        findBySubmissionId: Effect.fn("database.executionRepository.findBySubmissionId")(function* (
          executionSubmissionId,
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(execution)
            .where(
              and(
                eq(execution.executionSubmissionId, executionSubmissionId),
                eq(execution.organizationId, organizationId),
              ),
            )
            .limit(1);
          return rows[0] ? Schema.decodeSync(Execution)(rows[0] as any) : undefined;
        }, mapRepositoryError),
        findForOrganization: Effect.fn("database.executionRepository.findForOrganization")(
          function* (input) {
            const db = yield* transactionOrDatabase(database);
            const cursor =
              input.cursor === undefined
                ? undefined
                : yield* db.query.execution.findFirst({
                    where: {
                      id: { eq: input.cursor },
                      organizationId: { eq: input.organizationId },
                    },
                  });
            if (input.cursor !== undefined && cursor === undefined) return [];

            const rows = yield* db
              .select()
              .from(execution)
              .where(
                and(
                  eq(execution.organizationId, input.organizationId),
                  cursor === undefined
                    ? undefined
                    : or(
                        lt(execution.createdAt, cursor.createdAt),
                        and(eq(execution.createdAt, cursor.createdAt), lt(execution.id, cursor.id)),
                      ),
                ),
              )
              .orderBy(desc(execution.createdAt), desc(execution.id))
              .limit(Math.min(Math.max(Math.trunc(input.limit), 1), 100));
            return rows.map((row) => Schema.decodeSync(Execution)(row as any));
          },
          mapRepositoryError,
        ),
      });
    }),
  );
}
