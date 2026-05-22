import { Effect, Layer, Schema, Context } from "effect";

import { and, eq, isNull, ne } from "drizzle-orm";

import {
  type Database,
  session,
  TransactionOrDatabase,
} from "@namera-ai/database";
import {
  type Session,
  SessionId,
  SessionInsert,
  OrganizationId,
  type UserId,
  DatabaseError,
  mapDatabaseError,
} from "@namera-ai/schema";

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
  deleteSession: (
    id: SessionId,
  ) => Effect.Effect<void, DatabaseError, Database.Database>;
  deleteAllSessionsExcept: (
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
    createSession: (data) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const parsed = Schema.decodeSync(SessionInsert)(data);
        const res = yield* db.insert(session).values(parsed);
        // biome-ignore lint/style/noNonNullAssertion: safe
        return res[0]!;
      }).pipe(mapDatabaseError),
    deleteAllSessionsExcept: (userId, exceptSessionId) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const res = yield* db
          .delete(session)
          .where(
            and(eq(session.userId, userId), ne(session.id, exceptSessionId)),
          )
          .returning();

        return res;
      }).pipe(mapDatabaseError),
    deleteSession: (id) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        yield* db.delete(session).where(eq(session.id, id));
      }).pipe(mapDatabaseError),
    findSessionByToken: (token) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const res = yield* db.query.session.findFirst({
          where: {
            token: { eq: token },
          },
        });
        return res;
      }).pipe(mapDatabaseError),
    findSessionsForUserId: (userId) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const res = yield* db.query.session.findMany({
          orderBy: (sessions, { desc }) => [desc(sessions.createdAt)],
          where: {
            userId: { eq: userId },
            deletedAt: { isNull: true },
            revokedAt: { isNull: true },
          },
        });
        return res;
      }).pipe(mapDatabaseError),
    setActiveOrganization: (sessionId, userId, organizationId) =>
      Effect.gen(function* () {
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
      }).pipe(mapDatabaseError),
  }),
);
