// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError, Email, UserId } from "@namera-ai/protocol";
import { AdminUserEntry } from "@namera-ai/protocol/dto";
import { User, UserInsert, type UserMetadata, UserUpdate } from "@namera-ai/protocol/model";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";

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
  list: (input: {
    readonly limit: number;
    readonly cursor?: string;
    readonly search?: string;
  }) => Effect.Effect<ReadonlyArray<AdminUserEntry>, DatabaseError>;
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
        list: Effect.fn("database.userRepository.list")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const name = sql<string | null>`${user.metadata}->>'name'`;
          const rows = yield* db
            .select({
              id: user.id,
              email: user.email,
              emailVerified: user.emailVerified,
              name,
              lastLoginAt: user.lastLoginAt,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            })
            .from(user)
            .where(
              and(
                // id is a uuidv7, so ordering by it is creation order.
                // The cursor is an opaque id echoed back from a previous page.
                input.cursor ? lt(user.id, input.cursor as UserId) : undefined,
                // Literal substring search: '%' and '_' are not wildcards here.
                input.search
                  ? or(
                      sql`strpos(lower(${user.email}), ${input.search}) > 0`,
                      sql`strpos(lower(coalesce(${name}, '')), ${input.search}) > 0`,
                    )
                  : undefined,
              ),
            )
            .orderBy(desc(user.id))
            .limit(input.limit + 1);

          return Schema.decodeUnknownSync(Schema.Array(AdminUserEntry))(rows);
        }, mapRepositoryError),
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
