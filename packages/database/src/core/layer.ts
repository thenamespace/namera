import { PgClient } from "@effect/sql-pg";
import { Config, Effect, Layer, ServiceMap } from "effect";

import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { types } from "pg";

import { databaseConfig } from "../config";
import { relations } from "../relations";

const PgLive = PgClient.layerConfig({
  ...databaseConfig,
  types: {
    getTypeParser: Config.succeed((typeId, format) => {
      if ([1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)) {
        return (val: any) => val;
      }
      return types.getTypeParser(typeId, format);
    }),
  },
});

export const makeDatabase = PgDrizzle.make({ relations }).pipe(
  Effect.provide(PgDrizzle.DefaultServices),
);

export type Database = Effect.Success<typeof makeDatabase>;

export const Database = ServiceMap.Service<Database>("Database");
export const layer = Layer.provideMerge(Layer.effect(Database, makeDatabase), PgLive);
