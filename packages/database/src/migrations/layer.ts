import { fileURLToPath } from "node:url";

import { Context, Effect, Layer, Redacted, Schema } from "effect";

import { DatabaseError } from "@namera-ai/protocol";
import { SystemRoleInsert } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { DatabaseConfig } from "#/config";
import { systemRole } from "#/schema/index";

import { systemRoles } from "./data.js";

const migrationsFolder = fileURLToPath(new URL("../../migrations", import.meta.url));
const migrationLock = "namera_database_migrations";

export const runDatabaseMigrations = Effect.fn("database.runDatabaseMigrations")(function* () {
  const config = yield* DatabaseConfig;
  const pool = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new Pool({
          database: config.database,
          host: config.host,
          password: Redacted.value(config.password),
          port: config.port,
          user: config.username,
          max: 1,
        }),
    ),
    (clientPool) => Effect.promise(() => clientPool.end()),
  );
  const database = drizzle({ client: pool });
  const encodedRoles = Schema.encodeSync(Schema.Array(SystemRoleInsert))(systemRoles).map(
    (role) => ({
      key: role.key,
      metadata: role.metadata,
      permissions: [...role.permissions],
    }),
  );

  yield* Effect.tryPromise({
    try: async () => {
      await database.execute(sql`select pg_advisory_lock(hashtext(${migrationLock}))`);
      try {
        await database.execute(sql`create schema if not exists auth`);
        const result = await migrate(database, { migrationsFolder });
        if (result !== undefined) {
          throw new Error(`Drizzle migration initialization failed: ${result.exitCode}`);
        }
        await database
          .insert(systemRole)
          .values(encodedRoles)
          .onConflictDoUpdate({
            target: systemRole.key,
            set: {
              metadata: sql`excluded.metadata`,
              permissions: sql`excluded.permissions`,
            },
          });
      } finally {
        await database.execute(sql`select pg_advisory_unlock(hashtext(${migrationLock}))`);
      }
    },
    catch: (cause) =>
      new DatabaseError({
        cause,
        message: "Database migration failed",
      }),
  });

  yield* Effect.logInfo("database.migrations_completed");
}, Effect.scoped);

export class DatabaseMigration extends Context.Service<
  DatabaseMigration,
  { readonly completed: true }
>()("@namera-ai/database/DatabaseMigration") {
  static readonly layer = Layer.effect(
    DatabaseMigration,
    runDatabaseMigrations().pipe(Effect.as(DatabaseMigration.of({ completed: true }))),
  );
}
