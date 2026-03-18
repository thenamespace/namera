import { PgClient } from "@effect/sql-pg";
import type { UserId } from "@namera-ai/schema";
import * as pgDrizzle from "drizzle-orm/effect-postgres";
import { Config, Context, Effect, Layer, Option } from "effect";
import { types } from "pg";

import { adminDatabaseConfig, databaseConfig } from "./config";
import { relations } from "./relations";

const PgLive = PgClient.layerConfig({
  ...databaseConfig,
  types: {
    getTypeParser: Config.succeed((typeId, format) => {
      if (
        [1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)
      ) {
        // biome-ignore lint/suspicious/noExplicitAny: safe
        return (val: any) => val;
      }
      return types.getTypeParser(typeId, format);
    }),
  },
});

const PgAdminLive = PgClient.layerConfig({
  ...adminDatabaseConfig,
  types: {
    getTypeParser: Config.succeed((typeId, format) => {
      if (
        [1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)
      ) {
        // biome-ignore lint/suspicious/noExplicitAny: safe
        return (val: any) => val;
      }
      return types.getTypeParser(typeId, format);
    }),
  },
});

export const makeDatabase = pgDrizzle
  .make({ relations })
  .pipe(Effect.provide(pgDrizzle.DefaultServices));

export type DatabaseShape = Effect.Effect.Success<typeof makeDatabase>;
export type TransactionShape = Parameters<
  Parameters<DatabaseShape["transaction"]>[0]
>[0];

export class Database extends Context.Tag("Database")<
  Database,
  DatabaseShape
>() {}

export class AdminDatabase extends Context.Tag("AdminDatabase")<
  AdminDatabase,
  DatabaseShape
>() {}

export class TransactionClient extends Context.Tag("TransactionClient")<
  TransactionClient,
  TransactionShape
>() {}

export const TransactionOrDatabase = Effect.gen(function* () {
  const tx = yield* Effect.serviceOption(TransactionClient);
  if (Option.isSome(tx)) {
    return tx.value;
  }

  return yield* Database;
});

const DatabaseLayer = Layer.effect(
  Database,
  Effect.gen(function* () {
    return yield* makeDatabase;
  }),
);
const AdminDatabaseLayer = Layer.effect(
  AdminDatabase,
  Effect.gen(function* () {
    return yield* makeDatabase;
  }),
);

export const DatabaseLive = Layer.provideMerge(DatabaseLayer, PgLive);
export const AdminDatabaseLive = Layer.provideMerge(
  AdminDatabaseLayer,
  PgAdminLive,
);

export const withTx = (tx: TransactionShape) =>
  Effect.provideService(TransactionClient, tx);

export const transaction = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const db = yield* Database;

    return yield* db.transaction((tx) =>
      effect.pipe(Effect.provideService(TransactionClient, tx)),
    );
  });

export const setCurrentUser = (userId: UserId) =>
  Effect.gen(function* () {
    const db = yield* TransactionOrDatabase;
    yield* db
      .execute(`SET LOCAL app.user_id = '${userId.toString()}'`)
      .pipe(Effect.orDie);
  });
