import {
  type Database,
  TransactionOrDatabase,
  user,
} from "@namera-ai/database";
import type { UserId } from "@namera-ai/schema";
import {
  Email,
  type User,
  UserInsert,
  type UserUpdate,
} from "@namera-ai/schema";
import { eq } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

export type UserRepoShape = {
  findUserByEmail: (
    email: string,
  ) => Effect.Effect<User | undefined, never, Database>;
  createUser: (params: UserInsert) => Effect.Effect<User, never, Database>;
  updateUser: (
    id: UserId,
    params: UserUpdate,
  ) => Effect.Effect<void, never, Database>;
};

export class UserRepo extends Context.Tag("UserRepo")<
  UserRepo,
  UserRepoShape
>() {}

export const UserRepoLive = Layer.succeed(
  UserRepo,
  UserRepo.of({
    createUser: (params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;

        const parsed = yield* Schema.validate(UserInsert)(params);

        const res = yield* db.insert(user).values(parsed).returning();

        // biome-ignore lint/style/noNonNullAssertion: safe
        return res[0]!;
      }).pipe(Effect.orDie),
    findUserByEmail: (email) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;

        const parsedEmail = yield* Schema.validate(Email)(email);

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

        const parsed = yield* Schema.validate(UserInsert)(params);
        yield* db.update(user).set(parsed).where(eq(user.id, id));
      }).pipe(Effect.orDie),
  }),
);
