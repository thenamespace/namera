import { Layer, Context, Effect, Schema } from "effect";

import { eq } from "drizzle-orm";

import {
  TransactionOrDatabase,
  user,
  type Database,
} from "@namera-ai/database";
import {
  DatabaseError,
  Email,
  mapToDatabaseError,
  type UserId,
} from "@namera-ai/schema";
import { User, UserInsert, UserUpdate } from "@namera-ai/schema/database";

export type UserRepo = {
  findUserByEmail: (
    email: Email,
  ) => Effect.Effect<User | undefined, DatabaseError, Database.Database>;
  createUser: (
    params: UserInsert,
  ) => Effect.Effect<User, DatabaseError, Database.Database>;
  updateUser: (
    id: UserId,
    params: UserUpdate,
  ) => Effect.Effect<User, DatabaseError, Database.Database>;
};

export const UserRepo = Context.Service<UserRepo>("UserRepo");
export const layer = Layer.succeed(
  UserRepo,
  UserRepo.of({
    createUser: Effect.fn("createUser")(function* (params) {
      const db = yield* TransactionOrDatabase;
      const parsed = Schema.encodeSync(UserInsert)(params);
      const res = yield* db
        .insert(user)
        .values(parsed as any)
        .returning();

      return Schema.decodeUnknownSync(User)(res[0]!);
    }, mapToDatabaseError),
    findUserByEmail: Effect.fn("findUserByEmail")(function* (email) {
      const db = yield* TransactionOrDatabase;

      const res = yield* db.query.user.findFirst({
        where: {
          email: {
            eq: email,
          },
        },
      });

      return res ? Schema.decodeUnknownSync(User)(res) : undefined;
    }, mapToDatabaseError),
    updateUser: Effect.fn("updateUser")(function* (id, params) {
      const db = yield* TransactionOrDatabase;
      const parsed = Schema.encodeSync(UserUpdate)(params);
      const res = yield* db
        .update(user)
        .set(parsed as any)
        .where(eq(user.id, id))
        .returning();
      return Schema.decodeUnknownSync(User)(res[0]!);
    }, mapToDatabaseError),
  }),
);
