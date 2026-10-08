// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError, Email, UserId } from "@namera-ai/protocol";
import { User, UserInsert, type UserMetadata, UserUpdate } from "@namera-ai/protocol/model";
import { eq } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { user } from "#/schema/index";

export interface UserRepositoryService {
  findById: (userId: UserId) => Effect.Effect<User | undefined, DatabaseError>;
  findByEmail: (email: Email) => Effect.Effect<User | undefined, DatabaseError>;
  create: (data: UserInsert) => Effect.Effect<User, DatabaseError>;
  createIfAbsent: (data: UserInsert) => Effect.Effect<User | undefined, DatabaseError>;
  findOrCreateByEmail: (data: UserInsert) => Effect.Effect<User, DatabaseError>;
  markEmailVerifiedAndLogin: (
    userId: UserId,
    loggedInAt: DateTime.Utc,
  ) => Effect.Effect<User | undefined, DatabaseError>;
  updateMetadata: (
    userId: UserId,
    metadata: UserMetadata,
  ) => Effect.Effect<User | undefined, DatabaseError>;
}

export class UserRepository extends Context.Service<UserRepository, UserRepositoryService>()(
  "@namera-ai/database/UserRepository",
) {
  static readonly layer: Layer.Layer<UserRepository, never, Database> = Layer.effect(
    UserRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      const findByEmail = Effect.fn("database.userRepository.findByEmail")(function* (
        email: Email,
      ) {
        const db = yield* transactionOrDatabase(database);
        const row = yield* db.query.user.findFirst({
          where: {
            email: { eq: email },
          },
        });

        return row ? Schema.decodeSync(User)(row) : undefined;
      }, mapRepositoryError);

      return UserRepository.of({
        findById: Effect.fn("database.userRepository.findById")(function* (userId) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.user.findFirst({
            where: {
              id: { eq: userId },
            },
          });

          return row ? Schema.decodeSync(User)(row) : undefined;
        }, mapRepositoryError),
        findByEmail,
        createIfAbsent: Effect.fn("database.userRepository.createIfAbsent")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(UserInsert)(data);
          const rows = yield* db
            .insert(user)
            .values(parsed as any)
            .onConflictDoNothing({ target: user.email })
            .returning();
          return rows[0] ? Schema.decodeSync(User)(rows[0]) : undefined;
        }, mapRepositoryError),
        create: Effect.fn("database.userRepository.create")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(UserInsert)(data);
          const rows = yield* db
            .insert(user)
            .values(parsed as any)
            .returning();

          return Schema.decodeSync(User)(rows[0]!);
        }, mapRepositoryError),
        findOrCreateByEmail: Effect.fn("database.userRepository.findOrCreateByEmail")(function* (
          data,
        ) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(UserInsert)(data);
          const rows = yield* db
            .insert(user)
            .values(parsed as any)
            .onConflictDoNothing({ target: user.email })
            .returning();

          if (rows[0]) {
            return Schema.decodeSync(User)(rows[0]);
          }

          return yield* findByEmail(data.email).pipe(
            Effect.flatMap((existing) =>
              existing
                ? Effect.succeed(existing)
                : Effect.die("User disappeared after resolving the unique email conflict"),
            ),
          );
        }, mapRepositoryError),
        markEmailVerifiedAndLogin: Effect.fn("database.userRepository.markEmailVerifiedAndLogin")(
          function* (userId, loggedInAt) {
            const db = yield* transactionOrDatabase(database);
            const encodedLoggedInAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(loggedInAt);
            const rows = yield* db
              .update(user)
              .set({
                emailVerified: true,
                lastLoginAt: encodedLoggedInAt,
              })
              .where(eq(user.id, userId))
              .returning();

            return rows[0] ? Schema.decodeSync(User)(rows[0]) : undefined;
          },
          mapRepositoryError,
        ),
        updateMetadata: Effect.fn("database.userRepository.updateMetadata")(function* (
          userId,
          metadata,
        ) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(UserUpdate)({ metadata });
          const rows = yield* db
            .update(user)
            .set(parsed as any)
            .where(eq(user.id, userId))
            .returning();

          return rows[0] ? Schema.decodeSync(User)(rows[0]) : undefined;
        }, mapRepositoryError),
      });
    }),
  );
}
