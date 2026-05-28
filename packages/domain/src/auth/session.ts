import { Effect, Layer, Schema, Context } from "effect";

import { and, eq, isNull, ne } from "drizzle-orm";

import {
  type Database,
  session,
  TransactionOrDatabase,
} from "@namera-ai/database";
import {
  SessionId,
  OrganizationId,
  type UserId,
  DatabaseError,
  mapToDatabaseError,
} from "@namera-ai/schema";
import { Session, SessionInsert } from "@namera-ai/schema/database";

export type SessionRepo = {
  createSession: (
    data: SessionInsert,
  ) => Effect.Effect<Session, DatabaseError, Database.Database>;
  findSessionByToken: (
    token: string,
  ) => Effect.Effect<Session | undefined, DatabaseError, Database.Database>;
  findSessionsForUserId: (
    userId: UserId,
  ) => Effect.Effect<Session[], DatabaseError, Database.Database>;
  revokeSession: (
    id: SessionId,
  ) => Effect.Effect<void, DatabaseError, Database.Database>;
  revokeAllSessionsExcept: (
    userId: UserId,
    exceptSessionId: SessionId,
  ) => Effect.Effect<Session[], DatabaseError, Database.Database>;
  setActiveOrganization: (
    sessionId: SessionId,
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<void, DatabaseError, Database.Database>;
};

export const SessionRepo = Context.Service<SessionRepo>("SessionRepo");

export const layer = Layer.succeed(
  SessionRepo,
  SessionRepo.of({
    createSession: Effect.fn("createSession")(function* (data) {
      const db = yield* TransactionOrDatabase;
      const encoded = Schema.encodeUnknownSync(SessionInsert)(data);
      const res = yield* db
        .insert(session)
        .values(encoded as any)
        .returning();
      return Schema.decodeUnknownSync(Session)(res[0]!);
    }, mapToDatabaseError),
    revokeAllSessionsExcept: Effect.fn("revokeAllSessionsExcept")(function* (
      userId,
      exceptSessionId,
    ) {
      const db = yield* TransactionOrDatabase;
      const res = yield* db
        .update(session)
        .set({ revokedAt: new Date() })
        .where(and(eq(session.userId, userId), ne(session.id, exceptSessionId)))
        .returning();

      return res.map((r) => Schema.decodeUnknownSync(Session)(r));
    }, mapToDatabaseError),
    revokeSession: Effect.fn("revokeSession")(function* (id) {
      const db = yield* TransactionOrDatabase;
      yield* db
        .update(session)
        .set({ revokedAt: new Date() })
        .where(eq(session.id, id));
    }, mapToDatabaseError),
    findSessionByToken: Effect.fn("findSessionByToken")(function* (token) {
      const db = yield* TransactionOrDatabase;
      const res = yield* db.query.session.findFirst({
        where: {
          token: { eq: token },
        },
      });
      return res ? Schema.decodeUnknownSync(Session)(res) : undefined;
    }, mapToDatabaseError),
    findSessionsForUserId: Effect.fn("findSessionsForUserId")(function* (
      userId,
    ) {
      const db = yield* TransactionOrDatabase;
      const res = yield* db.query.session.findMany({
        orderBy: (sessions, { desc }) => [desc(sessions.createdAt)],
        where: {
          userId: { eq: userId },
          deletedAt: { isNull: true },
          revokedAt: { isNull: true },
        },
      });
      return res.map((r) => Schema.decodeUnknownSync(Session)(r));
    }, mapToDatabaseError),
    setActiveOrganization: Effect.fn("setActiveOrganization")(function* (
      sessionId,
      userId,
      organizationId,
    ) {
      const db = yield* TransactionOrDatabase;
      yield* db
        .update(session)
        .set({
          activeOrganizationId: organizationId,
        })
        .where(
          and(
            eq(session.id, sessionId),
            eq(session.userId, userId),
            isNull(session.deletedAt),
            isNull(session.revokedAt),
          ),
        );
    }, mapToDatabaseError),
  }),
);
