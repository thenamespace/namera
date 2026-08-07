import { Context, Effect, Layer, Option } from "effect";
import type { SqlError } from "effect/unstable/sql";

import { mapToDatabaseError, type MapDatabaseError } from "#/core/errors";
import { Database } from "#/core/layer";

export type TransactionClient = Parameters<Parameters<Database["transaction"]>[0]>[0];
export const TransactionClient = Context.Service<TransactionClient>("TransactionClient");

export const TransactionOrDatabase = Effect.gen(function* () {
  const tx = yield* Effect.serviceOption(TransactionClient);
  if (Option.isSome(tx)) {
    return tx.value;
  }

  return yield* Database;
});

export const transactionOrDatabase = (database: Database) =>
  Effect.gen(function* () {
    const tx = yield* Effect.serviceOption(TransactionClient);
    if (Option.isSome(tx)) {
      return tx.value;
    }

    return database;
  });

export type TransactionService = {
  run: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, MapDatabaseError<SqlError.SqlError | E>, Exclude<R, TransactionClient>>;
};

export const TransactionService = Context.Service<TransactionService>("TransactionService");

export const layer = Layer.effect(
  TransactionService,
  Effect.gen(function* () {
    const db = yield* Database;

    return TransactionService.of({
      run: (effect) =>
        db
          .transaction((tx) => effect.pipe(Effect.provideService(TransactionClient, tx)))
          .pipe(mapToDatabaseError),
    });
  }),
);
