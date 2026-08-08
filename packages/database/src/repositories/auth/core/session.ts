// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError } from "@namera-ai/protocol";
import { type OrganizationId, type SessionId, type UserId } from "@namera-ai/protocol";
import { Session, SessionInsert, SessionUpdate } from "@namera-ai/protocol/model";
import { and, eq, ne, sql } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { organizationMember, session } from "#/schema/index";

export interface SessionRepositoryService {
  insert: (data: SessionInsert) => Effect.Effect<Session, DatabaseError>;
  findByTokenHash: (tokenHash: string) => Effect.Effect<Session | undefined, DatabaseError>;
  findById: (sessionId: SessionId) => Effect.Effect<Session | undefined, DatabaseError>;
  findSessionsForUserId: (userId: UserId) => Effect.Effect<ReadonlyArray<Session>, DatabaseError>;
  updateAllExcept: (
    userId: UserId,
    sessionId: SessionId,
    data: SessionUpdate,
  ) => Effect.Effect<ReadonlyArray<Session>, DatabaseError>;
  update: (id: SessionId, data: SessionUpdate) => Effect.Effect<Session | undefined, DatabaseError>;
  setActiveOrganization: (
    sessionId: SessionId,
    userId: UserId,
    organizationId: OrganizationId,
    now: DateTime.Utc,
  ) => Effect.Effect<Session | undefined, DatabaseError>;
  clearActiveOrganization: (
    sessionId: SessionId,
    userId: UserId,
  ) => Effect.Effect<Session | undefined, DatabaseError>;
  clearActiveOrganizationForUser: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<Session>, DatabaseError>;
}

export class SessionRepository extends Context.Service<
  SessionRepository,
  SessionRepositoryService
>()("@namera-ai/database/SessionRepository") {
  static readonly layer: Layer.Layer<SessionRepository, never, Database> = Layer.effect(
    SessionRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return SessionRepository.of({
        insert: Effect.fn("insertSession")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(SessionInsert)(data);
          const res = yield* db
            .insert(session)
            .values(parsed as any)
            .returning();

          return Schema.decodeSync(Session)(res[0]!);
        }, mapToDatabaseError),
        findByTokenHash: Effect.fn("findSessionByTokenHash")(function* (tokenHash) {
          const db = yield* transactionOrDatabase(database);

          const res = yield* db.query.session.findFirst({
            where: {
              tokenHash: { eq: tokenHash },
            },
          });

          return res ? Schema.decodeSync(Session)(res) : undefined;
        }, mapToDatabaseError),
        findById: Effect.fn("findSessionById")(function* (sessionId) {
          const db = yield* transactionOrDatabase(database);

          const res = yield* db.query.session.findFirst({
            where: {
              id: { eq: sessionId },
            },
          });

          return res ? Schema.decodeSync(Session)(res) : undefined;
        }, mapToDatabaseError),
        findSessionsForUserId: Effect.fn("findSessionsForUserId")(function* (userId) {
          const db = yield* transactionOrDatabase(database);

          const res = yield* db.query.session.findMany({
            where: {
              userId: { eq: userId },
            },
          });

          return [...Schema.decodeSync(Schema.Array(Session))(res)];
        }, mapToDatabaseError),
        updateAllExcept: Effect.fn("updateAllSessionsExcept")(function* (userId, sessionId, data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(SessionUpdate)(data);
          const res = yield* db
            .update(session)
            .set(parsed as any)
            .where(and(eq(session.userId, userId), ne(session.id, sessionId)))
            .returning();

          return [...Schema.decodeSync(Schema.Array(Session))(res)];
        }, mapToDatabaseError),
        update: Effect.fn("updateSession")(function* (id, data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(SessionUpdate)(data);
          const res = yield* db
            .update(session)
            .set(parsed as any)
            .where(eq(session.id, id))
            .returning();

          return res[0] ? Schema.decodeSync(Session)(res[0]) : undefined;
        }, mapToDatabaseError),
        setActiveOrganization: Effect.fn("setSessionActiveOrganization")(function* (
          sessionId,
          userId,
          organizationId,
          now,
        ) {
          const db = yield* transactionOrDatabase(database);
          const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
          const res = yield* db
            .update(session)
            .set({ activeOrganizationId: organizationId })
            .where(
              and(
                eq(session.id, sessionId),
                eq(session.userId, userId),
                sql`${session.revokedAt} IS NULL`,
                sql`${session.expiresAt} > ${encodedNow}`,
                sql`EXISTS (
                  SELECT 1
                  FROM ${organizationMember}
                  WHERE ${organizationMember.userId} = ${userId}
                    AND ${organizationMember.organizationId} = ${organizationId}
                    AND ${organizationMember.removedAt} IS NULL
                )`,
              ),
            )
            .returning();

          return res[0] ? Schema.decodeSync(Session)(res[0]) : undefined;
        }, mapToDatabaseError),
        clearActiveOrganizationForUser: Effect.fn("clearUserActiveOrganization")(function* (
          userId,
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const res = yield* db
            .update(session)
            .set({ activeOrganizationId: null })
            .where(
              and(eq(session.userId, userId), eq(session.activeOrganizationId, organizationId)),
            )
            .returning();

          return Schema.decodeSync(Schema.Array(Session))(res);
        }, mapToDatabaseError),
        clearActiveOrganization: Effect.fn("clearSessionActiveOrganization")(function* (
          sessionId,
          userId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const res = yield* db
            .update(session)
            .set({ activeOrganizationId: null })
            .where(and(eq(session.id, sessionId), eq(session.userId, userId)))
            .returning();

          return res[0] ? Schema.decodeSync(Session)(res[0]) : undefined;
        }, mapToDatabaseError),
      });
    }),
  );
}
