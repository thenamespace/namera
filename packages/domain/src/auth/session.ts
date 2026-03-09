import { type Database, TransactionOrDatabase } from "@repo/database";
import {
  type Session,
  type SessionInsert,
  SessionInsertSchema,
  session,
} from "@repo/schema";
import { Context, Effect, Layer, Schema } from "effect";

export type SessionRepoShape = {
  createSession: (
    data: SessionInsert,
  ) => Effect.Effect<Session, never, Database>;
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
        const parsed = yield* Schema.validate(SessionInsertSchema)(data);
        const res = yield* db.insert(session).values(parsed);
        // biome-ignore lint/style/noNonNullAssertion: safe
        return res[0]!;
      }).pipe(Effect.orDie),
  }),
);
