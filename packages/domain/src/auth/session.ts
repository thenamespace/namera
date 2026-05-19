import { Effect, Layer, Schema, Context } from "effect";

import { and, eq, ne } from "drizzle-orm";

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
} from "@namera-ai/schema";

export type SessionRepo = {
  createSession: (
    data: SessionInsert,
  ) => Effect.Effect<Session, never, Database.Database>;
  findSessionByToken: (
    token: string,
  ) => Effect.Effect<Session | undefined, never, Database.Database>;
  findSessionsByUserId: (
    userId: UserId,
  ) => Effect.Effect<Session[], never, Database.Database>;
  deleteSession: (
    id: SessionId,
  ) => Effect.Effect<void, never, Database.Database>;
  deleteAllSessionsExcept: (
    userId: UserId,
    exceptSessionId: SessionId,
  ) => Effect.Effect<void, never, Database.Database>;
  setActiveOrganization: (
    sessionId: SessionId,
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<void, never, Database.Database>;
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
      }).pipe(Effect.orDie),
    deleteAllSessionsExcept: (userId, exceptSessionId) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        yield* db
          .delete(session)
          .where(
            and(eq(session.userId, userId), ne(session.id, exceptSessionId)),
          );
      }).pipe(Effect.orDie),
    deleteSession: (id) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        yield* db.delete(session).where(eq(session.id, id));
      }).pipe(Effect.orDie),
    findSessionByToken: (token) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const res = yield* db.query.session.findFirst({
          where: {
            token: { eq: token },
          },
        });
        return res;
      }).pipe(Effect.orDie),
    findSessionsByUserId: (userId) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const res = yield* db.query.session.findMany({
          orderBy: (sessions, { desc }) => [desc(sessions.createdAt)],
          where: {
            userId: { eq: userId },
          },
        });
        return res;
      }).pipe(Effect.orDie),
    setActiveOrganization: (sessionId, userId, organizationId) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        yield* db
          .update(session)
          .set({
            activeOrganizationId: organizationId,
          })
          .where(and(eq(session.id, sessionId), eq(session.userId, userId)));
      }).pipe(Effect.orDie),
  }),
);
