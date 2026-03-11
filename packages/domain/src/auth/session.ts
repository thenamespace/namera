import {
  type Database,
  session,
  TransactionOrDatabase,
} from "@namera-ai/database";
import { type Session, SessionInsert, type UserId } from "@namera-ai/schema";
import { and, eq, ne } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

export type SessionRepoShape = {
  createSession: (
    data: SessionInsert,
  ) => Effect.Effect<Session, never, Database>;
  findSessionByToken: (
    token: string,
  ) => Effect.Effect<Session | undefined, never, Database>;
  findSessionsByUserId: (
    userId: UserId,
  ) => Effect.Effect<Session[], never, Database>;
  deleteSession: (id: string) => Effect.Effect<void, never, Database>;
  deleteAllSessionsExcept: (
    userId: UserId,
    exceptSessionId: string,
  ) => Effect.Effect<void, never, Database>;
};

export class SessionRepo extends Context.Tag("SessionRepo")<
  SessionRepo,
  SessionRepoShape
>() {}

export const SessionRepoLive = Layer.succeed(
  SessionRepo,
  SessionRepo.of({
    createSession: (data) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const parsed = yield* Schema.validate(SessionInsert)(data);
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
  }),
);
