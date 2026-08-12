import { fileURLToPath } from "node:url";

import { Context, Effect, Layer, Schema } from "effect";

import { SystemRoleInsert } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/effect-pglite/migrator";

import { Database, type DatabaseService } from "#/core/layer";
import { systemRoles } from "#/migrations/data";
import {
  account,
  actor,
  invitation,
  organization,
  organizationEvent,
  organizationMember,
  organizationRole,
  session,
  systemRole,
  user,
  userEvent,
  verification,
  wallet,
  walletKey,
} from "#/schema/index";

const migrationsFolder = fileURLToPath(new URL("../../migrations", import.meta.url));

const encodedSystemRoles = Schema.encodeSync(Schema.Array(SystemRoleInsert))(systemRoles).map(
  (role) => ({
    key: role.key,
    metadata: role.metadata,
    permissions: [...role.permissions],
  }),
);

const seedSystemRoles = Effect.fn("TestDatabase.seedSystemRoles")(function* (
  database: DatabaseService,
) {
  yield* database.insert(systemRole).values(encodedSystemRoles);
});

const migrateDatabase = Effect.gen(function* () {
  const database = yield* Database;
  yield* database.execute(sql`create schema if not exists auth`);
  yield* migrate(database, { migrationsFolder });
  yield* seedSystemRoles(database);
});

export class TestDatabase extends Context.Service<
  TestDatabase,
  { readonly reset: Effect.Effect<void> }
>()("@namera-ai/database/TestDatabase") {
  static readonly layer = Layer.mergeAll(
    Layer.effect(
      TestDatabase,
      Effect.gen(function* () {
        const database = yield* Database;

        const reset = Effect.fn("TestDatabase.reset")(function* () {
          yield* database.delete(organizationEvent);
          yield* database.delete(userEvent);
          yield* database.delete(wallet);
          yield* database.delete(walletKey);
          yield* database.delete(invitation);
          yield* database.delete(organizationMember);
          yield* database.delete(actor);
          yield* database.delete(organizationRole);
          yield* database.delete(session);
          yield* database.delete(account);
          yield* database.delete(verification);
          yield* database.delete(organization);
          yield* database.delete(user);
          yield* database.delete(systemRole);
          yield* seedSystemRoles(database);
        }, Effect.orDie);

        return TestDatabase.of({ reset: reset() });
      }),
    ),
    Layer.effectDiscard(migrateDatabase),
  ).pipe(Layer.provideMerge(Database.pgliteLayer));
}
