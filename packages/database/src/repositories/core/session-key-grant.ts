// oxlint-disable typescript/no-explicit-any
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type {
  ActorId,
  DatabaseError,
  OrganizationId,
  SessionKeyGrantId,
  SessionKeyId,
} from "@namera-ai/protocol";
import {
  SessionKey,
  SessionKeyGrant,
  SessionKeyGrantInsert,
  type SessionKey as SessionKeyModel,
  type SessionKeyGrant as SessionKeyGrantModel,
  type SessionKeyGrantInsert as SessionKeyGrantInsertModel,
} from "@namera-ai/protocol/model";
import { and, desc, eq, inArray, isNull, count } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { sessionKey, sessionKeyGrant } from "#/schema/index";

export interface SessionKeyGrantView {
  readonly grant: SessionKeyGrantModel;
  readonly sessionKey: SessionKeyModel;
}

export interface SessionKeyGrantRepositoryService {
  readonly countRevokedForSession: (input: {
    readonly organizationId: OrganizationId;
    readonly sessionKeyId: SessionKeyId;
    readonly revokedAt: DateTime.Utc;
  }) => Effect.Effect<number, DatabaseError>;
  readonly insertMany: (
    data: ReadonlyArray<SessionKeyGrantInsertModel>,
  ) => Effect.Effect<ReadonlyArray<SessionKeyGrantModel>, DatabaseError>;
  readonly findActiveForActor: (
    organizationId: OrganizationId,
    actorId: ActorId,
  ) => Effect.Effect<ReadonlyArray<SessionKeyGrantView>, DatabaseError>;
  readonly findByIdWithSessionKey: (
    id: SessionKeyGrantId,
    organizationId: OrganizationId,
    forUpdate?: boolean,
  ) => Effect.Effect<SessionKeyGrantView | undefined, DatabaseError>;
  readonly findActiveForActors: (
    organizationId: OrganizationId,
    actorIds: ReadonlyArray<ActorId>,
  ) => Effect.Effect<ReadonlyArray<SessionKeyGrantView>, DatabaseError>;
  readonly revokeActiveForActor: (
    organizationId: OrganizationId,
    actorId: ActorId,
    revokedByActorId: ActorId,
    revokedAt: DateTime.Utc,
  ) => Effect.Effect<ReadonlyArray<SessionKeyGrantModel>, DatabaseError>;
  readonly revokeActiveForSessionKey: (
    organizationId: OrganizationId,
    sessionKeyId: SessionKeyGrantModel["sessionKeyId"],
    revokedByActorId: ActorId,
    revokedAt: DateTime.Utc,
  ) => Effect.Effect<ReadonlyArray<SessionKeyGrantModel>, DatabaseError>;
}

export class SessionKeyGrantRepository extends Context.Service<
  SessionKeyGrantRepository,
  SessionKeyGrantRepositoryService
>()("@namera-ai/database/SessionKeyGrantRepository") {
  static readonly layer: Layer.Layer<SessionKeyGrantRepository, never, Database> = Layer.effect(
    SessionKeyGrantRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      const findActiveForActors = Effect.fn(
        "database.sessionKeyGrantRepository.findActiveForActors",
      )(function* (organizationId: OrganizationId, actorIds: ReadonlyArray<ActorId>) {
        if (actorIds.length === 0) return [];
        const db = yield* transactionOrDatabase(database);
        const rows = yield* db
          .select({ grant: sessionKeyGrant, sessionKey })
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
              inArray(sessionKeyGrant.actorId, actorIds),
              isNull(sessionKeyGrant.revokedAt),
              eq(sessionKey.status, "active"),
            ),
          )
          .orderBy(desc(sessionKeyGrant.createdAt), desc(sessionKeyGrant.id));
        return rows.map((row) => ({
          grant: Schema.decodeSync(SessionKeyGrant)(row.grant as any),
          sessionKey: Schema.decodeSync(SessionKey)(row.sessionKey as any),
        }));
      }, mapRepositoryError);

      return SessionKeyGrantRepository.of({
        countRevokedForSession: Effect.fn(
          "database.sessionKeyGrantRepository.countRevokedForSession",
        )(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const [row] = yield* db
            .select({ count: count() })
            .from(sessionKeyGrant)
            .where(
              and(
                eq(sessionKeyGrant.organizationId, input.organizationId),
                eq(sessionKeyGrant.sessionKeyId, input.sessionKeyId),
                eq(
                  sessionKeyGrant.revokedAt,
                  Schema.encodeSync(Schema.DateTimeUtcFromDate)(input.revokedAt),
                ),
              ),
            );
          return row?.count ?? 0;
        }, mapRepositoryError),
        insertMany: Effect.fn("database.sessionKeyGrantRepository.insertMany")(function* (data) {
          if (data.length === 0) return [];
          const db = yield* transactionOrDatabase(database);
          const encoded = data.map((item) => Schema.encodeSync(SessionKeyGrantInsert)(item));
          const rows = yield* db
            .insert(sessionKeyGrant)
            .values(encoded as any)
            .returning();
          return rows.map((row) => Schema.decodeSync(SessionKeyGrant)(row as any));
        }, mapRepositoryError),
        findActiveForActor: Effect.fn("database.sessionKeyGrantRepository.findActiveForActor")(
          function* (organizationId, actorId) {
            return yield* findActiveForActors(organizationId, [actorId]);
          },
        ),
        findByIdWithSessionKey: Effect.fn(
          "database.sessionKeyGrantRepository.findByIdWithSessionKey",
        )(function* (id, organizationId, forUpdate = false) {
          const db = yield* transactionOrDatabase(database);
          const query = db
            .select({ grant: sessionKeyGrant, sessionKey })
            .from(sessionKeyGrant)
            .innerJoin(
              sessionKey,
              and(
                eq(sessionKey.id, sessionKeyGrant.sessionKeyId),
                eq(sessionKey.organizationId, sessionKeyGrant.organizationId),
              ),
            )
            .where(
              and(eq(sessionKeyGrant.id, id), eq(sessionKeyGrant.organizationId, organizationId)),
            )
            .limit(1);
          const rows = yield* forUpdate ? query.for("update") : query;
          const row = rows[0];
          return row === undefined
            ? undefined
            : {
                grant: Schema.decodeSync(SessionKeyGrant)(row.grant as any),
                sessionKey: Schema.decodeSync(SessionKey)(row.sessionKey as any),
              };
        }, mapRepositoryError),
        findActiveForActors,
        revokeActiveForActor: Effect.fn("database.sessionKeyGrantRepository.revokeActiveForActor")(
          function* (organizationId, actorId, revokedByActorId, revokedAt) {
            const db = yield* transactionOrDatabase(database);
            const encodedRevokedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(revokedAt);
            const rows = yield* db
              .update(sessionKeyGrant)
              .set({ revokedAt: encodedRevokedAt, revokedByActorId })
              .where(
                and(
                  eq(sessionKeyGrant.organizationId, organizationId),
                  eq(sessionKeyGrant.actorId, actorId),
                  isNull(sessionKeyGrant.revokedAt),
                ),
              )
              .returning();
            return rows.map((row) => Schema.decodeSync(SessionKeyGrant)(row as any));
          },
          mapRepositoryError,
        ),
        revokeActiveForSessionKey: Effect.fn(
          "database.sessionKeyGrantRepository.revokeActiveForSessionKey",
        )(function* (organizationId, sessionKeyId, revokedByActorId, revokedAt) {
          const db = yield* transactionOrDatabase(database);
          const encodedRevokedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(revokedAt);
          const rows = yield* db
            .update(sessionKeyGrant)
            .set({ revokedAt: encodedRevokedAt, revokedByActorId })
            .where(
              and(
                eq(sessionKeyGrant.organizationId, organizationId),
                eq(sessionKeyGrant.sessionKeyId, sessionKeyId),
                isNull(sessionKeyGrant.revokedAt),
              ),
            )
            .returning();
          return rows.map((row) => Schema.decodeSync(SessionKeyGrant)(row as any));
        }, mapRepositoryError),
      });
    }),
  );
}
