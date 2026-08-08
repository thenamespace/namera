// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError, Email } from "@namera-ai/protocol";
import { type UserId } from "@namera-ai/protocol";
import { User, UserInsert, UserUpdate } from "@namera-ai/protocol/model";
import { eq } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { user } from "#/schema/index";

export interface UserRepositoryService {
  findById: (id: UserId) => Effect.Effect<User | undefined, DatabaseError>;
  findByEmail: (email: Email) => Effect.Effect<User | undefined, DatabaseError>;
  insert: (params: UserInsert) => Effect.Effect<User, DatabaseError>;
  update: (id: UserId, params: UserUpdate) => Effect.Effect<User, DatabaseError>;
}

export class UserRepository extends Context.Service<UserRepository, UserRepositoryService>()(
  "@namera-ai/database/UserRepository",
) {
  static readonly layer: Layer.Layer<UserRepository, never, Database> = Layer.effect(
    UserRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return UserRepository.of({
        findById: Effect.fn("findUserById")(function* (id) {
          const db = yield* transactionOrDatabase(database);

          const res = yield* db.query.user.findFirst({
            where: {
              id: { eq: id },
            },
          });

          return res ? Schema.decodeSync(User)(res) : undefined;
        }, mapToDatabaseError),
        insert: Effect.fn("insertUser")(function* (params) {
          const db = yield* transactionOrDatabase(database);

          const parsed = Schema.encodeSync(UserInsert)(params);

          const res = yield* db
            .insert(user)
            .values(parsed as any)
            .returning();

          return Schema.decodeSync(User)(res[0]!);
        }, mapToDatabaseError),
        findByEmail: Effect.fn("findUserByEmail")(function* (email) {
          const db = yield* transactionOrDatabase(database);

          const res = yield* db.query.user.findFirst({
            where: {
              email: { eq: email },
            },
          });

          return res ? Schema.decodeSync(User)(res) : undefined;
        }, mapToDatabaseError),
        update: Effect.fn("updateUser")(function* (id, params) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(UserUpdate)(params);
          const res = yield* db
            .update(user)
            .set(parsed as any)
            .where(eq(user.id, id))
            .returning();

          return Schema.decodeSync(User)(res[0]!);
        }, mapToDatabaseError),
      });
    }),
  );
}
