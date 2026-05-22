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
  mapDatabaseError,
  UserInsert,
  UserUpdate,
  type User,
  type UserId,
} from "@namera-ai/schema";

export type UserRepo = {
  findUserByEmail: (
    email: string,
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
    createUser: (params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const parsed = Schema.decodeSync(UserInsert)(params);
        const res = yield* db.insert(user).values(parsed).returning();

        return res[0]!;
      }).pipe(mapDatabaseError),
    findUserByEmail: (email) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;

        const parsedEmail = Schema.decodeSync(Email)(email);

        const res = yield* db.query.user.findFirst({
          where: {
            email: {
              eq: parsedEmail,
            },
          },
        });

        return res;
      }).pipe(mapDatabaseError),
    updateUser: (id, params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;

        const parsed = Schema.decodeSync(UserUpdate)(params);
        const res = yield* db
          .update(user)
          .set(parsed)
          .where(eq(user.id, id))
          .returning();
        return res[0]!;
      }).pipe(mapDatabaseError),
  }),
);
