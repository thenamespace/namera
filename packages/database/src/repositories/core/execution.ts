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
import { and, desc, eq } from "drizzle-orm";

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
  readonly findForOrganization: (
    organizationId: OrganizationId,
    limit?: number,
  ) => Effect.Effect<ReadonlyArray<ExecutionModel>, DatabaseError>;
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
          function* (organizationId, limit = 100) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(execution)
              .where(eq(execution.organizationId, organizationId))
              .orderBy(desc(execution.createdAt), desc(execution.id))
              .limit(limit);
            return rows.map((row) => Schema.decodeSync(Execution)(row as any));
          },
          mapRepositoryError,
        ),
      });
    }),
  );
}
