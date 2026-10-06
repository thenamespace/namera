// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema } from "effect";

import {
  type ActorId,
  type DatabaseError,
  type ExecutionId,
  type ExecutionSubmissionId,
  type OrganizationId,
  type SessionKeyId,
  type WalletId,
} from "@namera-ai/protocol";
import {
  Execution,
  ExecutionInsert,
  type Execution as ExecutionModel,
  type ExecutionInsert as ExecutionInsertModel,
} from "@namera-ai/protocol/model";
import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import {
  actor,
  execution,
  executionSubmission,
  sessionKey,
  sessionKeyGrant,
  wallet,
  signingKey,
} from "#/schema/index";

import {
  decodeExecutionDetailsView,
  decodeExecutionListView,
  type ExecutionDetailsView,
  type ExecutionListView,
  executionListSelection,
} from "./execution-view.js";

export type { ExecutionDetailsView, ExecutionListView } from "./execution-view.js";

export interface ExecutionRepositoryService {
  readonly insert: (data: ExecutionInsertModel) => Effect.Effect<ExecutionModel, DatabaseError>;
  readonly findById: (
    id: ExecutionId,
    organizationId: OrganizationId,
  ) => Effect.Effect<ExecutionModel | undefined, DatabaseError>;
  readonly findDetailsById: (
    id: ExecutionId,
    organizationId: OrganizationId,
  ) => Effect.Effect<ExecutionDetailsView | undefined, DatabaseError>;
  readonly findBySubmissionId: (
    executionSubmissionId: ExecutionSubmissionId,
    organizationId: OrganizationId,
  ) => Effect.Effect<ExecutionModel | undefined, DatabaseError>;
  readonly findForOrganization: (input: {
    readonly organizationId: OrganizationId;
    readonly cursor?: ExecutionId;
    readonly walletId?: WalletId;
    readonly sessionKeyId?: SessionKeyId;
    readonly limit: number;
  }) => Effect.Effect<ReadonlyArray<ExecutionListView>, DatabaseError>;
  readonly findByIdForActor: (
    id: ExecutionId,
    organizationId: OrganizationId,
    actorId: ActorId,
  ) => Effect.Effect<ExecutionModel | undefined, DatabaseError>;
  readonly findDetailsByIdForActor: (
    id: ExecutionId,
    organizationId: OrganizationId,
    actorId: ActorId,
  ) => Effect.Effect<ExecutionDetailsView | undefined, DatabaseError>;
  readonly findForActor: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly cursor?: ExecutionId;
    readonly walletId?: WalletId;
    readonly sessionKeyId?: SessionKeyId;
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

      // The historical grant identifies the key; today's grant controls visibility.
      // A subquery avoids duplicate history rows after revocation and regranting.
      const grantedHistory = (organizationId: OrganizationId, actorId: ActorId) =>
        inArray(
          sessionKeyGrant.sessionKeyId,
          database
            .select({ sessionKeyId: sessionKeyGrant.sessionKeyId })
            .from(sessionKeyGrant)
            .innerJoin(
              sessionKey,
              and(
                eq(sessionKey.id, sessionKeyGrant.sessionKeyId),
                eq(sessionKey.organizationId, sessionKeyGrant.organizationId),
              ),
            )
            .where(
              and(
                eq(sessionKeyGrant.organizationId, organizationId),
                eq(sessionKeyGrant.actorId, actorId),
                isNull(sessionKeyGrant.revokedAt),
                eq(sessionKey.status, "active"),
              ),
            ),
        );

      const findDetails = Effect.fnUntraced(function* (
        id: ExecutionId,
        organizationId: OrganizationId,
        actorId?: ActorId,
      ) {
        const db = yield* transactionOrDatabase(database);
        const rows = yield* db
          .select({ execution, actor, sessionKey, wallet, signingKey })
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
            signingKey,
            and(
              eq(signingKey.id, wallet.signingKeyId),
              eq(signingKey.organizationId, execution.organizationId),
            ),
          )
          .where(
            and(
              eq(execution.id, id),
              eq(execution.organizationId, organizationId),
              actorId === undefined ? undefined : grantedHistory(organizationId, actorId),
            ),
          )
          .limit(1);
        return rows[0] === undefined ? undefined : decodeExecutionDetailsView(rows[0]);
      });

      const findListCursor = Effect.fnUntraced(function* (input: {
        readonly organizationId: OrganizationId;
        readonly actorId?: ActorId;
        readonly cursor?: ExecutionId;
        readonly walletId?: WalletId;
        readonly sessionKeyId?: SessionKeyId;
      }) {
        if (input.cursor === undefined) return undefined;

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
          .where(
            and(
              eq(execution.id, input.cursor),
              eq(execution.organizationId, input.organizationId),
              input.actorId === undefined
                ? undefined
                : grantedHistory(input.organizationId, input.actorId),
              input.walletId === undefined ? undefined : eq(sessionKey.walletId, input.walletId),
              input.sessionKeyId === undefined ? undefined : eq(sessionKey.id, input.sessionKeyId),
            ),
          )
          .limit(1);
        return rows[0]?.execution;
      });

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
        findDetailsById: Effect.fn("database.executionRepository.findDetailsById")(function* (
          id,
          organizationId,
        ) {
          return yield* findDetails(id, organizationId);
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
            const cursor = yield* findListCursor(input);
            if (input.cursor !== undefined && cursor === undefined) return [];

            const rows = yield* db
              .select(executionListSelection)
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
              .where(
                and(
                  eq(execution.organizationId, input.organizationId),
                  input.walletId === undefined
                    ? undefined
                    : eq(sessionKey.walletId, input.walletId),
                  input.sessionKeyId === undefined
                    ? undefined
                    : eq(sessionKey.id, input.sessionKeyId),
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
              sessionKeyGrant,
              and(
                eq(sessionKeyGrant.id, execution.sessionKeyGrantId),
                eq(sessionKeyGrant.organizationId, execution.organizationId),
              ),
            )
            .where(
              and(
                eq(execution.id, id),
                eq(execution.organizationId, organizationId),
                grantedHistory(organizationId, actorId),
              ),
            )
            .limit(1);
          return rows[0] === undefined
            ? undefined
            : Schema.decodeSync(Execution)(rows[0].execution as any);
        }, mapRepositoryError),
        findDetailsByIdForActor: Effect.fn("database.executionRepository.findDetailsByIdForActor")(
          function* (id, organizationId, actorId) {
            return yield* findDetails(id, organizationId, actorId);
          },
          mapRepositoryError,
        ),
        findForActor: Effect.fn("database.executionRepository.findForActor")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const cursor = yield* findListCursor(input);
          if (input.cursor !== undefined && cursor === undefined) return [];

          const rows = yield* db
            .select(executionListSelection)
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
            .where(
              and(
                eq(execution.organizationId, input.organizationId),
                grantedHistory(input.organizationId, input.actorId),
                input.walletId === undefined ? undefined : eq(sessionKey.walletId, input.walletId),
                input.sessionKeyId === undefined
                  ? undefined
                  : eq(sessionKey.id, input.sessionKeyId),
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
