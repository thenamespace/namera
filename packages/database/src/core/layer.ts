import { PgClient } from "@effect/sql-pg";
import { PgliteClient } from "@effect/sql-pglite";
import { Context, Effect, Layer } from "effect";

import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import * as PgliteDrizzle from "drizzle-orm/effect-pglite";
import * as PgDrizzle from "drizzle-orm/effect-postgres";

import { databaseConfig } from "#/config";
import { relations } from "#/relations/index";

export const PgLive = PgClient.layerConfig(databaseConfig);

export type DatabaseService = PgDrizzle.EffectPgDatabase<typeof relations>;

export const makeDatabase: Effect.Effect<DatabaseService, never, PgClient.PgClient> =
  PgDrizzle.make({
    relations,
  }).pipe(Effect.provide(PgDrizzle.DefaultServices));

export class Database extends Context.Service<Database, DatabaseService>()(
  "@namera-ai/database/Database",
) {
  static readonly layer = Layer.effect(Database, makeDatabase).pipe(Layer.provide(PgLive));

  static readonly devLayer = Database.layer;

  static readonly testLayer = Layer.effect(
    Database,
    PgliteDrizzle.makeWithDefaults({ relations }),
  ).pipe(
    Layer.provide(
      PgliteClient.layer({
        extensions: { pg_trgm },
      }),
    ),
  );
}
