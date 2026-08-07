// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError } from "@namera-ai/protocol";
import { type SessionId, type UserId } from "@namera-ai/protocol";
import { Session, SessionInsert, SessionUpdate } from "@namera-ai/protocol/model";
import { and, eq, ne } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { session } from "#/schema/index";

export type SessionRepository = {
  insert: (data: SessionInsert) => Effect.Effect<Session, DatabaseError>;
  findByToken: (token: string) => Effect.Effect<Session | undefined, DatabaseError>;
  findById: (sessionId: SessionId) => Effect.Effect<Session | undefined, DatabaseError>;
  findSessionsForUserId: (userId: UserId) => Effect.Effect<Array<Session>, DatabaseError>;
  updateAllExcept: (
    userId: UserId,
    sessionId: SessionId,
    data: SessionUpdate,
  ) => Effect.Effect<Array<Session>, DatabaseError>;
  update: (id: SessionId, data: SessionUpdate) => Effect.Effect<Session, DatabaseError>;
};

export const SessionRepository = Context.Service<SessionRepository>("SessionRepository");

export const layer: Layer.Layer<SessionRepository, never, Database.Database> = Layer.effect(
  SessionRepository,
  Effect.gen(function* () {
    const database = yield* Database.Database;

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
      findByToken: Effect.fn("findSessionByToken")(function* (token) {
        const db = yield* transactionOrDatabase(database);

        const res = yield* db.query.session.findFirst({
          where: {
            token: { eq: token },
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

        return Schema.decodeSync(Session)(res[0]!);
      }, mapToDatabaseError),
    });
  }),
);
