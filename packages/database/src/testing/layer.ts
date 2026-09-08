import { fileURLToPath } from "node:url";

import { ConfigProvider, Context, Effect, Layer, Schema } from "effect";

import { SystemRoleInsert } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/effect-pglite/migrator";

import { Database, type DatabaseService } from "#/core/layer";
import { systemRoles } from "#/migrations/data";
import { runDatabaseMigrations } from "#/migrations/layer";
import {
  account,
  apiKey,
  actor,
  billingAccount,
  billingMeterBalance,
  billingPeriod,
  billingProviderEvent,
  billingSubscription,
  billingSubscriptionItem,
  billingUsageDelivery,
  billingUsageEvent,
  billingUsageReservation,
  emailJob,
  execution,
  executionSubmission,
  invitation,
  notification,
  notificationPreference,
  notificationRecipient,
  oauthAuthorization,
  oauthAuthorizationCode,
  oauthAuthorizationRequest,
  oauthClient,
  oauthDeviceAuthorization,
  oauthToken,
  organization,
  organizationEvent,
  organizationMember,
  organizationRole,
  session,
  sessionKey,
  sessionKeyInstallation,
  sessionKeyOperation,
  sessionKeyGrant,
  sessionKeyPolicyReservation,
  sessionKeyPolicyState,
  signingKey,
  signatureOperation,
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

const seedSystemRoles = Effect.fn("database.testDatabase.seedSystemRoles")(function* (
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
  private static readonly resetLayer = Layer.effect(
    TestDatabase,
    Effect.gen(function* () {
      const database = yield* Database;

      const reset = Effect.fn("database.testDatabase.reset")(function* () {
        yield* database.delete(notificationRecipient);
        yield* database.delete(notificationPreference);
        yield* database.delete(notification);
        yield* database.delete(emailJob);
        yield* database.delete(oauthToken);
        yield* database.delete(oauthAuthorizationCode);
        yield* database.delete(oauthDeviceAuthorization);
        yield* database.delete(billingUsageDelivery);
        yield* database.delete(billingUsageEvent);
        yield* database.delete(billingUsageReservation);
        yield* database.delete(billingMeterBalance);
        yield* database.delete(billingPeriod);
        yield* database.delete(billingSubscriptionItem);
        yield* database.delete(billingProviderEvent);
        yield* database.delete(billingSubscription);
        yield* database.delete(billingAccount);
        yield* database.delete(organizationEvent);
        yield* database.delete(userEvent);
        yield* database.delete(execution);
        yield* database.delete(signatureOperation);
        yield* database.delete(sessionKeyPolicyReservation);
        yield* database.delete(executionSubmission);
        yield* database.delete(sessionKeyPolicyState);
        yield* database.delete(sessionKeyGrant);
        yield* database.delete(oauthAuthorization);
        yield* database.delete(oauthAuthorizationRequest);
        yield* database.delete(oauthClient);
        yield* database.delete(sessionKeyOperation);
        yield* database.delete(sessionKeyInstallation);
        yield* database.delete(sessionKey);
        yield* database.delete(wallet);
        yield* database.delete(walletKey);
        yield* database.delete(signingKey);
        yield* database.delete(invitation);
        yield* database.delete(organizationMember);
        yield* database.delete(apiKey);
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
  );

  static readonly layer = Layer.mergeAll(
    TestDatabase.resetLayer,
    Layer.effectDiscard(migrateDatabase),
  ).pipe(Layer.provideMerge(Database.testLayer));

  /** Destructive reset is restricted to the disposable local test database. */
  static postgresLayer(port: number) {
    if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 5432) {
      throw new Error("PostgreSQL tests require a separate loopback port (not 5432)");
    }
    return Layer.mergeAll(
      TestDatabase.resetLayer,
      Layer.effectDiscard(runDatabaseMigrations()),
    ).pipe(
      Layer.provideMerge(Database.layer),
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown(
            {
              POSTGRES_HOST: "127.0.0.1",
              POSTGRES_PORT: port,
              POSTGRES_DATABASE: "namera_test",
              POSTGRES_USERNAME: "postgres",
              POSTGRES_PASSWORD: "",
            },
            { preserveEmptyStrings: true },
          ),
        ),
      ),
    );
  }
}
