// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError, UserId } from "@namera-ai/protocol";
import { UserEvent, UserEventInsert } from "@namera-ai/protocol/model";
import { desc, eq } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { userEvent } from "#/schema/index";

export interface UserEventRepositoryService {
  readonly insert: (data: UserEventInsert) => Effect.Effect<UserEvent, DatabaseError>;
  readonly findForUser: (
    userId: UserId,
    limit?: number,
  ) => Effect.Effect<ReadonlyArray<UserEvent>, DatabaseError>;
}

export class UserEventRepository extends Context.Service<
  UserEventRepository,
  UserEventRepositoryService
>()("@namera-ai/database/UserEventRepository") {
  static readonly layer: Layer.Layer<UserEventRepository, never, Database> = Layer.effect(
    UserEventRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return UserEventRepository.of({
        insert: Effect.fn("UserEventRepository.insert")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(UserEventInsert)(data);
          const rows = yield* db
            .insert(userEvent)
            .values(parsed as any)
            .returning();

          return Schema.decodeSync(UserEvent)(rows[0]! as any);
        }, mapToDatabaseError),
        findForUser: Effect.fn("UserEventRepository.findForUser")(function* (userId, limit = 100) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(userEvent)
            .where(eq(userEvent.userId, userId))
            .orderBy(desc(userEvent.createdAt))
            .limit(limit);

          return Schema.decodeSync(Schema.Array(UserEvent))(rows as any);
        }, mapToDatabaseError),
      });
    }),
  );
}
