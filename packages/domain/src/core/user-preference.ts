import { Effect, Layer, Schema, Context } from "effect";

import { eq } from "drizzle-orm";

import {
  Database,
  TransactionOrDatabase,
  userPreferences,
} from "@namera-ai/database";
import { DatabaseError, mapToDatabaseError, UserId } from "@namera-ai/schema";
import {
  UserPreference,
  UserPreferenceInsert,
  UserPreferenceUpdate,
} from "@namera-ai/schema/database";

export type UserPreferenceRepo = {
  get: (
    userId: UserId,
  ) => Effect.Effect<UserPreference, DatabaseError, Database.Database>;
  update: (
    userId: UserId,
    data: UserPreferenceUpdate,
  ) => Effect.Effect<UserPreference, DatabaseError, Database.Database>;
  create: (
    data: UserPreferenceInsert,
  ) => Effect.Effect<UserPreference, DatabaseError, Database.Database>;
};

export const UserPreferenceRepo =
  Context.Service<UserPreferenceRepo>("UserPreferenceRepo");

export const layer = Layer.succeed(
  UserPreferenceRepo,
  UserPreferenceRepo.of({
    get: Effect.fn("getUserPreferences")(function* (userId) {
      const db = yield* TransactionOrDatabase;
      const res = yield* db.query.userPreferences.findFirst({
        where: {
          userId: { eq: userId },
        },
      });
      const parsed = Schema.decodeUnknownSync(UserPreference)(res);
      return parsed;
    }, mapToDatabaseError),
    update: Effect.fn("updateUserPreferences")(function* (userId, data) {
      const db = yield* TransactionOrDatabase;
      const encoded = Schema.encodeUnknownSync(UserPreferenceUpdate)(data);
      const res = yield* db
        .update(userPreferences)
        .set(encoded as any)
        .where(eq(userPreferences.userId, userId))
        .returning();
      return Schema.decodeUnknownSync(UserPreference)(res[0]);
    }, mapToDatabaseError),
    create: (data) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const encoded = Schema.encodeUnknownSync(UserPreferenceInsert)(data);

        const res = yield* db
          .insert(userPreferences)
          .values(encoded as any)
          .returning();
        return Schema.decodeUnknownSync(UserPreference)(res[0]);
      }).pipe(mapToDatabaseError),
  }),
);
