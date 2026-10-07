import { Context, DateTime, Effect, Layer, Schema } from "effect";

import type { AccountId, DatabaseError, Email, UserId } from "@namera-ai/protocol";
import { Account } from "@namera-ai/protocol/model";
import { and, eq } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { account, user } from "#/schema/index";

export class AccountRepository extends Context.Service<
  AccountRepository,
  {
    readonly findGoogle: (subject: string) => Effect.Effect<Account | undefined, DatabaseError>;
    readonly list: (userId: UserId) => Effect.Effect<readonly Account[], DatabaseError>;
    readonly lockUser: (userId: UserId) => Effect.Effect<void, DatabaseError>;
    readonly linkGoogle: (input: {
      userId: UserId;
      subject: string;
      email: Email;
    }) => Effect.Effect<Account | undefined, DatabaseError>;
    readonly unlink: (
      id: AccountId,
      userId: UserId,
    ) => Effect.Effect<Account | undefined, DatabaseError>;
    readonly touchGoogle: (subject: string, email: Email) => Effect.Effect<void, DatabaseError>;
  }
>()("@namera-ai/database/AccountRepository") {
  static readonly layer = Layer.effect(
    AccountRepository,
    Effect.gen(function* () {
      const database = yield* Database;
      return AccountRepository.of({
        findGoogle: Effect.fn("database.accountRepository.findGoogle")(function* (subject) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(account)
            .where(and(eq(account.providerId, "google"), eq(account.accountId, subject)))
            .limit(1);
          return rows[0] ? Schema.decodeSync(Account)(rows[0]) : undefined;
        }, mapRepositoryError),
        list: Effect.fn("database.accountRepository.list")(function* (userId) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(account)
            .where(and(eq(account.userId, userId), eq(account.providerId, "google")));
          return Schema.decodeSync(Schema.Array(Account))(rows);
        }, mapRepositoryError),
        lockUser: Effect.fn("database.accountRepository.lockUser")(function* (userId) {
          const db = yield* transactionOrDatabase(database);
          yield* db.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
        }, mapRepositoryError),
        linkGoogle: Effect.fn("database.accountRepository.linkGoogle")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .insert(account)
            .values({
              userId: input.userId,
              providerId: "google",
              accountId: input.subject,
              providerEmail: input.email,
            })
            .onConflictDoNothing()
            .returning();
          return rows[0] ? Schema.decodeSync(Account)(rows[0]) : undefined;
        }, mapRepositoryError),
        unlink: Effect.fn("database.accountRepository.unlink")(function* (id, userId) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .delete(account)
            .where(
              and(eq(account.id, id), eq(account.userId, userId), eq(account.providerId, "google")),
            )
            .returning();
          return rows[0] ? Schema.decodeSync(Account)(rows[0]) : undefined;
        }, mapRepositoryError),
        touchGoogle: Effect.fn("database.accountRepository.touchGoogle")(function* (
          subject,
          email,
        ) {
          const db = yield* transactionOrDatabase(database);
          yield* db
            .update(account)
            .set({ providerEmail: email, lastUsedAt: DateTime.toDate(yield* DateTime.now) })
            .where(and(eq(account.providerId, "google"), eq(account.accountId, subject)));
        }, mapRepositoryError),
      });
    }),
  );
}
