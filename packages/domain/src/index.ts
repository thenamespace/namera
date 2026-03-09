import { Database } from "@repo/database";
import type { PgEffectTransaction } from "drizzle-orm/pg-core/effect";
import { Effect } from "effect";

//   transaction<A, E, R>(transaction: (tx: PgEffectTransaction<TEffectHKT, TQueryResult, TFullSchema, TRelations, TSchema>) => Effect.Effect<A, E, R>): Effect.Effect<A, E | _effect_sql_SqlError0.SqlError, R>;
export const withTx = <A, E, R>(
  tx: Transaction,
  effect: Effect.Effect<A, E, R>,
) => effect.pipe(Effect.provideService(Database, tx));
