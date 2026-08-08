// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError, OrganizationId, SessionId, UserId } from "@namera-ai/protocol";
import { Session, SessionInsert } from "@namera-ai/protocol/model";
import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { organizationMember, session } from "#/schema/index";

export interface SessionRepositoryService {
  create: (data: SessionInsert) => Effect.Effect<Session, DatabaseError>;
  findActiveByTokenHash: (
    tokenHash: string,
    now: DateTime.Utc,
  ) => Effect.Effect<Session | undefined, DatabaseError>;
  findActiveForUser: (
    userId: UserId,
    now: DateTime.Utc,
  ) => Effect.Effect<ReadonlyArray<Session>, DatabaseError>;
  revoke: (
    sessionId: SessionId,
    userId: UserId,
    revokedAt: DateTime.Utc,
  ) => Effect.Effect<Session | undefined, DatabaseError>;
  revokeOthers: (
    userId: UserId,
    currentSessionId: SessionId,
    revokedAt: DateTime.Utc,
  ) => Effect.Effect<number, DatabaseError>;
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
        create: Effect.fn("SessionRepository.create")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(SessionInsert)(data);
          const rows = yield* db
            .insert(session)
            .values(parsed as any)
            .returning();

          return Schema.decodeSync(Session)(rows[0]!);
        }, mapToDatabaseError),
        findActiveByTokenHash: Effect.fn("SessionRepository.findActiveByTokenHash")(function* (
          tokenHash,
          now,
        ) {
          const db = yield* transactionOrDatabase(database);
          const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
          const rows = yield* db
            .select()
            .from(session)
            .where(
              and(
                eq(session.tokenHash, tokenHash),
                isNull(session.revokedAt),
                gt(session.expiresAt, encodedNow),
              ),
            )
            .limit(1);

          return rows[0] ? Schema.decodeSync(Session)(rows[0]) : undefined;
        }, mapToDatabaseError),
        findActiveForUser: Effect.fn("SessionRepository.findActiveForUser")(function* (
          userId,
          now,
        ) {
          const db = yield* transactionOrDatabase(database);
          const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
          const rows = yield* db
            .select()
            .from(session)
            .where(
              and(
                eq(session.userId, userId),
                isNull(session.revokedAt),
                gt(session.expiresAt, encodedNow),
              ),
            );

          return Schema.decodeSync(Schema.Array(Session))(rows);
        }, mapToDatabaseError),
        revoke: Effect.fn("SessionRepository.revoke")(function* (sessionId, userId, revokedAt) {
          const db = yield* transactionOrDatabase(database);
          const encodedRevokedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(revokedAt);
          const rows = yield* db
            .update(session)
            .set({ revokedAt: encodedRevokedAt })
            .where(
              and(eq(session.id, sessionId), eq(session.userId, userId), isNull(session.revokedAt)),
            )
            .returning();

          return rows[0] ? Schema.decodeSync(Session)(rows[0]) : undefined;
        }, mapToDatabaseError),
        revokeOthers: Effect.fn("SessionRepository.revokeOthers")(function* (
          userId,
          currentSessionId,
          revokedAt,
        ) {
          const db = yield* transactionOrDatabase(database);
          const encodedRevokedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(revokedAt);
          const rows = yield* db
            .update(session)
            .set({ revokedAt: encodedRevokedAt })
            .where(
              and(
                eq(session.userId, userId),
                ne(session.id, currentSessionId),
                isNull(session.revokedAt),
              ),
            )
            .returning({ id: session.id });

          return rows.length;
        }, mapToDatabaseError),
        setActiveOrganization: Effect.fn("SessionRepository.setActiveOrganization")(function* (
          sessionId,
          userId,
          organizationId,
          now,
        ) {
          const db = yield* transactionOrDatabase(database);
          const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
          const rows = yield* db
            .update(session)
            .set({ activeOrganizationId: organizationId })
            .where(
              and(
                eq(session.id, sessionId),
                eq(session.userId, userId),
                isNull(session.revokedAt),
                gt(session.expiresAt, encodedNow),
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

          return rows[0] ? Schema.decodeSync(Session)(rows[0]) : undefined;
        }, mapToDatabaseError),
        clearActiveOrganizationForUser: Effect.fn(
          "SessionRepository.clearActiveOrganizationForUser",
        )(function* (userId, organizationId) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(session)
            .set({ activeOrganizationId: null })
            .where(
              and(eq(session.userId, userId), eq(session.activeOrganizationId, organizationId)),
            )
            .returning();

          return Schema.decodeSync(Schema.Array(Session))(rows);
        }, mapToDatabaseError),
        clearActiveOrganization: Effect.fn("SessionRepository.clearActiveOrganization")(function* (
          sessionId,
          userId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(session)
            .set({ activeOrganizationId: null })
            .where(and(eq(session.id, sessionId), eq(session.userId, userId)))
            .returning();

          return rows[0] ? Schema.decodeSync(Session)(rows[0]) : undefined;
        }, mapToDatabaseError),
      });
    }),
  );
}
