import { Context, Effect, Layer, Option } from "effect";
import type { SqlError } from "effect/unstable/sql";

import { mapToDatabaseError, type MapDatabaseError } from "#/core/errors";
import { Database, type DatabaseService } from "#/core/layer";

type TransactionClientService = Parameters<Parameters<DatabaseService["transaction"]>[0]>[0];

class TransactionClient extends Context.Service<TransactionClient, TransactionClientService>()(
  "@namera-ai/database/TransactionClient",
) {}

export type DatabaseExecutor = Pick<DatabaseService, "delete" | "insert" | "query" | "update">;

export const transactionOrDatabase = Effect.fn("transactionOrDatabase")(function* (
  database: DatabaseService,
): Effect.fn.Return<DatabaseExecutor> {
  const tx = yield* Effect.serviceOption(TransactionClient);
  if (Option.isSome(tx)) {
    return tx.value;
  }

  return database;
});

export interface TransactionServiceService {
  run: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, MapDatabaseError<SqlError.SqlError | E>, R>;
}

export class TransactionService extends Context.Service<
  TransactionService,
  TransactionServiceService
>()("@namera-ai/database/TransactionService") {
  static readonly layer = Layer.effect(
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
}
