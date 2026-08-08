import { PgClient } from "@effect/sql-pg";
import { Config, Context, Effect, Layer } from "effect";

import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { types as pgTypes } from "pg";

import { databaseConfig } from "#/config";
import { relations } from "#/relations/index";

export const PgLive = PgClient.layerConfig({
  ...databaseConfig,
  types: {
    getTypeParser: Config.succeed(((typeId, format) => {
      if ([1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)) {
        return (value: string) => value;
      }
      return pgTypes.getTypeParser(typeId, format);
    }) as typeof pgTypes.getTypeParser),
  },
});

export type DatabaseService = PgDrizzle.EffectPgDatabase<typeof relations> & {
  $client: PgClient.PgClient;
};

export const makeDatabase: Effect.Effect<DatabaseService, never, PgClient.PgClient> =
  PgDrizzle.make({
    relations,
  }).pipe(Effect.provide(PgDrizzle.DefaultServices));

export class Database extends Context.Service<Database, DatabaseService>()(
  "@namera-ai/database/Database",
) {
  static readonly layer = Layer.effect(Database, makeDatabase).pipe(Layer.provide(PgLive));
}
