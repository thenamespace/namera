import { Config, ConfigProvider, Data, Effect, Redacted } from "effect";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const migrationsFolder = new URL("../drizzle-migrations", import.meta.url)
  .pathname;

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
  const config = yield* migrationsEnvConfig;

  const pool = yield* Effect.acquireRelease(
    Effect.sync(() => {
      return new Pool({
        database: config.database,
        host: config.host,
        password: Redacted.value(config.password),
        port: config.port,
        ssl: process.env.POSTGRES_SSL === "true",
        user: config.username,
      });
    }),
    (p) => Effect.promise(() => p.end()),
  );

  const db = drizzle({ client: pool });

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
        `ALTER ROLE app_user WITH PASSWORD '${Redacted.value(config.appUserPassword)}'`,
      );
      await db.execute(
        `ALTER ROLE app_admin WITH PASSWORD '${Redacted.value(config.appAdminPassword)}'`,
      );
    },
    catch: () => new MigrationError({ exitCode: "alterPasswordFailed" }),
  });

  yield* Effect.log("Migrations completed successfully");
}).pipe(
  Effect.scoped,
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromEnv(),
  ),
);

Effect.runPromise(runMigrations);
