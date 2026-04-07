import { PgClient } from "@effect/sql-pg";
import { Config, Layer, ServiceMap } from "effect";

import { types } from "pg";

import { adminDatabaseConfig } from "../config";
import { makeDatabase, type Database } from "./layer";

const PgAdminLive = PgClient.layerConfig({
  ...adminDatabaseConfig,
  types: {
    getTypeParser: Config.succeed((typeId, format) => {
      if (
        [1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)
      ) {
        return (val: any) => val;
      }
      return types.getTypeParser(typeId, format);
    }),
  },
});

const AdminDatabase = ServiceMap.Service<Database>("AdminDatabase");

export const layer = Layer.provideMerge(
  Layer.effect(AdminDatabase, makeDatabase),
  PgAdminLive,
);
