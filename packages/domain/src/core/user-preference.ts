import { Effect, Layer, Schema, Context } from "effect";

import { eq } from "drizzle-orm";

import {
  Database,
  TransactionOrDatabase,
  userPreference,
} from "@namera-ai/database";
import {
  DatabaseError,
  mapDatabaseError,
  UserId,
  UserPreference,
  UserPreferenceInsert,
  UserPreferenceUpdate,
} from "@namera-ai/schema";

export type UserPreferenceRepo = {
  get: (
    userId: UserId,
  ) => Effect.Effect<UserPreference, DatabaseError, Database.Database>;
  update: (
    userId: UserId,
    data: UserPreferenceUpdate,
  ) => Effect.Effect<UserPreference, DatabaseError, Database.Database>;
  create: (
    userId: UserId,
    data: UserPreferenceInsert,
  ) => Effect.Effect<UserPreference, DatabaseError, Database.Database>;
};

export const UserPreferenceRepo =
  Context.Service<UserPreferenceRepo>("UserPreferenceRepo");

export const layer = Layer.succeed(
  UserPreferenceRepo,
  UserPreferenceRepo.of({
    get: (userId) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const res = yield* db.query.userPreference.findFirst({
          where: {
            userId: { eq: userId },
          },
        });
        const parsed = Schema.decodeUnknownSync(UserPreference)(res);
        return parsed;
      }).pipe(mapDatabaseError),
    update: (userId, data) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const res = yield* db
          .update(userPreference)
          .set(data)
          .where(eq(userPreference.userId, userId))
          .returning();
        return Schema.decodeUnknownSync(UserPreference)(res[0]);
      }).pipe(mapDatabaseError),
    create: (userId, data) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const res = yield* db.insert(userPreference).values(data).returning();
        return Schema.decodeUnknownSync(UserPreference)(res[0]);
      }).pipe(mapDatabaseError),
  }),
);
