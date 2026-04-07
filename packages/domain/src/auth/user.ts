import { Layer, ServiceMap, Effect, Schema } from "effect";

import { eq } from "drizzle-orm";

import {
  TransactionOrDatabase,
  user,
  type Database,
} from "@namera-ai/database";
import {
  Email,
  UserInsert,
  UserUpdate,
  type User,
  type UserId,
} from "@namera-ai/schema";

export type UserRepo = {
  findUserByEmail: (
    email: string,
  ) => Effect.Effect<User | undefined, never, Database.Database>;
  createUser: (
    params: UserInsert,
  ) => Effect.Effect<User, never, Database.Database>;
  updateUser: (
    id: UserId,
    params: UserUpdate,
  ) => Effect.Effect<void, never, Database.Database>;
};

export const UserRepo = ServiceMap.Service<UserRepo>("UserRepo");
export const layer = Layer.succeed(
  UserRepo,
  UserRepo.of({
    createUser: (params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;

        const parsed = Schema.decodeSync(UserInsert)(params);

        const res = yield* db.insert(user).values(parsed).returning();

        return res[0]!;
      }).pipe(Effect.orDie),
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
      }).pipe(Effect.orDie),
    updateUser: (id, params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;

        const parsed = Schema.decodeSync(UserUpdate)(params);
        yield* db.update(user).set(parsed).where(eq(user.id, id));
      }).pipe(Effect.orDie),
  }),
);
