import { PgClient } from "@effect/sql-pg";
import { Config, Context, Effect, Layer } from "effect";

import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { types as pgTypes } from "pg";

import { databaseConfig } from "#/config";
// import { relations } from "#/relations/index";

const PgLive = PgClient.layerConfig({
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

export const makeDatabase = PgDrizzle.make({}).pipe(Effect.provide(PgDrizzle.DefaultServices));

export type Database = Effect.Success<typeof makeDatabase>;

export const Database = Context.Service<Database>("Database");

export const layer = Layer.provideMerge(Layer.effect(Database, makeDatabase), PgLive);
