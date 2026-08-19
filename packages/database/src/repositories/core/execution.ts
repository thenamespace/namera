// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema } from "effect";

import type {
  ActorId,
  DatabaseError,
  ExecutionId,
  ExecutionSubmissionId,
  OrganizationId,
} from "@namera-ai/protocol";
import {
  Actor,
  Execution,
  ExecutionInsert,
  SessionKey,
  Wallet,
  WalletKey,
  type Actor as ActorModel,
  type Execution as ExecutionModel,
  type ExecutionInsert as ExecutionInsertModel,
  type SessionKey as SessionKeyModel,
} from "@namera-ai/protocol/model";
import { and, desc, eq, lt, or } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import {
  actor,
  execution,
  executionSubmission,
  sessionKey,
  sessionKeyGrant,
  wallet,
  walletKey,
} from "#/schema/index";

import type { WalletView } from "./wallet.js";

export interface ExecutionListView {
  readonly execution: ExecutionModel;
  readonly actor: ActorModel;
  readonly sessionKey: SessionKeyModel;
  readonly wallet: WalletView;
}

const decodeExecutionListView = (row: {
  readonly execution: unknown;
  readonly actor: unknown;
  readonly sessionKey: unknown;
  readonly wallet: unknown;
  readonly walletKey: unknown;
}): ExecutionListView => ({
  execution: Schema.decodeSync(Execution)(row.execution as any),
  actor: Schema.decodeSync(Actor)(row.actor as any),
  sessionKey: Schema.decodeSync(SessionKey)(row.sessionKey as any),
  wallet: {
    wallet: Schema.decodeSync(Wallet)(row.wallet as any),
    walletKey: Schema.decodeSync(WalletKey)(row.walletKey as any),
  },
});

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
  }) => Effect.Effect<ReadonlyArray<ExecutionListView>, DatabaseError>;
  readonly findByIdForActor: (
    id: ExecutionId,
    organizationId: OrganizationId,
    actorId: ActorId,
  ) => Effect.Effect<ExecutionModel | undefined, DatabaseError>;
  readonly findForActor: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly cursor?: ExecutionId;
    readonly limit: number;
  }) => Effect.Effect<ReadonlyArray<ExecutionListView>, DatabaseError>;
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
              .select({ execution, actor, sessionKey, wallet, walletKey })
              .from(execution)
              .innerJoin(
                executionSubmission,
                and(
                  eq(executionSubmission.id, execution.executionSubmissionId),
                  eq(executionSubmission.organizationId, execution.organizationId),
                ),
              )
              .innerJoin(
                actor,
                and(
                  eq(actor.id, executionSubmission.actorId),
                  eq(actor.organizationId, execution.organizationId),
                ),
              )
              .innerJoin(
                sessionKeyGrant,
                and(
                  eq(sessionKeyGrant.id, execution.sessionKeyGrantId),
                  eq(sessionKeyGrant.organizationId, execution.organizationId),
                ),
              )
              .innerJoin(
                sessionKey,
                and(
                  eq(sessionKey.id, sessionKeyGrant.sessionKeyId),
                  eq(sessionKey.organizationId, execution.organizationId),
                ),
              )
              .innerJoin(
                wallet,
                and(
                  eq(wallet.id, sessionKey.walletId),
                  eq(wallet.organizationId, execution.organizationId),
                ),
              )
              .innerJoin(
                walletKey,
                and(
                  eq(walletKey.id, wallet.walletKeyId),
                  eq(walletKey.organizationId, execution.organizationId),
                ),
              )
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
            return rows.map(decodeExecutionListView);
          },
          mapRepositoryError,
        ),
        findByIdForActor: Effect.fn("database.executionRepository.findByIdForActor")(function* (
          id,
          organizationId,
          actorId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select({ execution })
            .from(execution)
            .innerJoin(
              executionSubmission,
              and(
                eq(executionSubmission.id, execution.executionSubmissionId),
                eq(executionSubmission.organizationId, execution.organizationId),
              ),
            )
            .where(
              and(
                eq(execution.id, id),
                eq(execution.organizationId, organizationId),
                eq(executionSubmission.actorId, actorId),
              ),
            )
            .limit(1);
          return rows[0] === undefined
            ? undefined
            : Schema.decodeSync(Execution)(rows[0].execution as any);
        }, mapRepositoryError),
        findForActor: Effect.fn("database.executionRepository.findForActor")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const cursorRows =
            input.cursor === undefined
              ? []
              : yield* db
                  .select({ execution })
                  .from(execution)
                  .innerJoin(
                    executionSubmission,
                    and(
                      eq(executionSubmission.id, execution.executionSubmissionId),
                      eq(executionSubmission.organizationId, execution.organizationId),
                    ),
                  )
                  .where(
                    and(
                      eq(execution.id, input.cursor),
                      eq(execution.organizationId, input.organizationId),
                      eq(executionSubmission.actorId, input.actorId),
                    ),
                  )
                  .limit(1);
          const cursor = cursorRows[0]?.execution;
          if (input.cursor !== undefined && cursor === undefined) return [];

          const rows = yield* db
            .select({ execution, actor, sessionKey, wallet, walletKey })
            .from(execution)
            .innerJoin(
              executionSubmission,
              and(
                eq(executionSubmission.id, execution.executionSubmissionId),
                eq(executionSubmission.organizationId, execution.organizationId),
              ),
            )
            .innerJoin(
              actor,
              and(
                eq(actor.id, executionSubmission.actorId),
                eq(actor.organizationId, execution.organizationId),
              ),
            )
            .innerJoin(
              sessionKeyGrant,
              and(
                eq(sessionKeyGrant.id, execution.sessionKeyGrantId),
                eq(sessionKeyGrant.organizationId, execution.organizationId),
              ),
            )
            .innerJoin(
              sessionKey,
              and(
                eq(sessionKey.id, sessionKeyGrant.sessionKeyId),
                eq(sessionKey.organizationId, execution.organizationId),
              ),
            )
            .innerJoin(
              wallet,
              and(
                eq(wallet.id, sessionKey.walletId),
                eq(wallet.organizationId, execution.organizationId),
              ),
            )
            .innerJoin(
              walletKey,
              and(
                eq(walletKey.id, wallet.walletKeyId),
                eq(walletKey.organizationId, execution.organizationId),
              ),
            )
            .where(
              and(
                eq(execution.organizationId, input.organizationId),
                eq(executionSubmission.actorId, input.actorId),
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
          return rows.map(decodeExecutionListView);
        }, mapRepositoryError),
      });
    }),
  );
}
