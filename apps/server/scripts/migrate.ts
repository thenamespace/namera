import { config } from "dotenv";
config();

import { NodeRuntime } from "@effect/platform-node";
import { Config, ConfigProvider, Data, Effect, Redacted, Schema } from "effect";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { relations, systemRole } from "@namera-ai/database";
import {
  SystemRoleInsert,
  systemRolesInsert,
} from "@namera-ai/schema/database";

const migrationsFolder = new URL(
  "../../../packages/database/drizzle-migrations",
  import.meta.url,
).pathname;

const migrationsEnvConfig = Config.all({
  database: Config.string("POSTGRES_DATABASE"),
  host: Config.string("POSTGRES_HOST"),
  port: Config.number("POSTGRES_PORT"),
  username: Config.string("POSTGRES_USERNAME"),
  password: Config.redacted("POSTGRES_PASSWORD"),
  appUserPassword: Config.redacted("POSTGRES_APP_USER_PASSWORD"),
  appAdminPassword: Config.redacted("POSTGRES_APP_ADMIN_PASSWORD"),
});

class MigrationError extends Data.TaggedError("MigrationError")<{
  readonly exitCode: string;
}> {}

const runMigrations = Effect.gen(function* () {
  const env = yield* migrationsEnvConfig;

  const pool = yield* Effect.acquireRelease(
    Effect.sync(() => {
      return new Pool({
        database: env.database,
        host: env.host,
        password: Redacted.value(env.password),
        port: env.port,
        ssl: process.env.POSTGRES_SSL === "true",
        user: env.username,
      });
    }),
    (p) => Effect.promise(() => p.end()),
  );

  const db = drizzle({ client: pool, relations: relations });

  yield* Effect.tryPromise({
    try: async () => {
      const result = await migrate(db, { migrationsFolder });
      if (result) {
        throw new Error(result.exitCode);
      }
    },
    catch: (e) => new MigrationError({ exitCode: (e as Error).message }),
  });

  yield* Effect.tryPromise({
    try: async () => {
      await db.execute(
        `ALTER ROLE app_user WITH PASSWORD '${Redacted.value(env.appUserPassword)}'`,
      );
      await db.execute(
        `ALTER ROLE app_admin WITH PASSWORD '${Redacted.value(env.appAdminPassword)}'`,
      );
    },
    catch: () => new MigrationError({ exitCode: "alterPasswordFailed" }),
  });

  yield* Effect.tryPromise({
    try: async () => {
      const systemRoles = Schema.encodeUnknownSync(
        Schema.Array(SystemRoleInsert),
      )(systemRolesInsert);
      await db
        .insert(systemRole)
        .values(systemRoles as any)
        .onConflictDoUpdate({
          target: systemRole.key,
          targetWhere: sql`${systemRole.deletedAt} IS NULL`,
          set: {
            permissions: sql`excluded.permissions`,
            metadata: sql`excluded.metadata`,
            version: sql`${systemRole.version} + 1`,
          },
        });
    },
    catch: () =>
      new MigrationError({ exitCode: "createOrUpdateSystemRoleFailed" }),
  });

  yield* Effect.log("Migrations completed successfully");
}).pipe(
  Effect.scoped,
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromEnv(),
  ),
);

NodeRuntime.runMain(runMigrations);
