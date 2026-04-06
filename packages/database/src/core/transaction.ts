import { Effect, ServiceMap } from "effect";

import type { Database } from "./layer";
import { TransactionOrDatabase } from "./tx-or-db";

export type TransactionClient = Parameters<Parameters<Database["transaction"]>[0]>[0];
export const TransactionClient = ServiceMap.Service<TransactionClient>("TransactionClient");

export const withTx = (tx: TransactionClient) => Effect.provideService(TransactionClient, tx);

export const setCurrentUser = (userId: UserId) =>
  Effect.gen(function* () {
    const db = yield* TransactionOrDatabase;
    yield* db.execute(`SET LOCAL app.user_id = '${userId.toString()}'`).pipe(Effect.orDie);
  });
