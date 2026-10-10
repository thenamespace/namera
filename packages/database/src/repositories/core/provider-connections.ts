import { Context, Effect, Layer, Schema } from "effect";

import type {
  CredentialId,
  DatabaseError,
  OrganizationId,
  ProviderConnectionId,
} from "@namera-ai/protocol";
import { ProviderConnection, ProviderConnectionInsert } from "@namera-ai/protocol/model";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { credentials, providerConnections } from "#/schema/index";

type Scope = { readonly id: ProviderConnectionId; readonly organizationId: OrganizationId };
type Lease = Scope & { readonly leaseToken: string };

export interface ProviderConnectionsRepositoryService {
  readonly reserve: (
    input: ProviderConnectionInsert,
  ) => Effect.Effect<ProviderConnection | undefined, DatabaseError>;
  readonly findByOrganization: (
    organizationId: OrganizationId,
    providerAppId: string,
  ) => Effect.Effect<ProviderConnection | undefined, DatabaseError>;
  readonly acquireLease: (input: Lease) => Effect.Effect<boolean, DatabaseError>;
  readonly releaseLease: (input: Lease) => Effect.Effect<boolean, DatabaseError>;
  readonly reconcileIdentity: (
    input: Lease & { readonly externalConnectionId: string; readonly customerId: string },
  ) => Effect.Effect<ProviderConnection | undefined, DatabaseError>;
  readonly recordBootstrap: (
    input: Lease,
  ) => Effect.Effect<ProviderConnection | undefined, DatabaseError>;
  readonly attachCustomerCredential: (
    input: Lease & { readonly credentialId: CredentialId },
  ) => Effect.Effect<ProviderConnection | undefined, DatabaseError>;
  readonly markReady: (
    input: Lease,
  ) => Effect.Effect<ProviderConnection | undefined, DatabaseError>;
  readonly disable: (input: Scope) => Effect.Effect<ProviderConnection | undefined, DatabaseError>;
}

const scope = (input: Scope) =>
  and(
    eq(providerConnections.id, input.id),
    eq(providerConnections.organizationId, input.organizationId),
  );
const ownedLease = (input: Lease) =>
  and(
    scope(input),
    ne(providerConnections.status, "disabled"),
    eq(providerConnections.leaseToken, input.leaseToken),
    sql`${providerConnections.leaseExpiresAt} > now()`,
  );
const decode = (row: unknown) =>
  row === undefined ? undefined : Schema.decodeUnknownSync(ProviderConnection)(row);

export class ProviderConnectionsRepository extends Context.Service<
  ProviderConnectionsRepository,
  ProviderConnectionsRepositoryService
>()("@namera-ai/database/ProviderConnectionsRepository") {
  static readonly layer = Layer.effect(
    ProviderConnectionsRepository,
    Effect.gen(function* () {
      const database = yield* Database;
      return ProviderConnectionsRepository.of({
        reserve: Effect.fn("database.providerConnections.reserve")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(ProviderConnectionInsert)(input);
          // Reservation cannot assert remote identity or completed setup.
          if (
            input.status !== "pending" ||
            input.externalConnectionId !== null ||
            input.customerCredentialId !== null ||
            input.data.customerId !== null ||
            input.data.bootstrapCompletedAt !== null ||
            input.data.delegationEnabledAt !== null
          )
            return undefined;
          const rows = yield* db
            .insert(providerConnections)
            .values({
              ...encoded,
              id: input.id,
              organizationId: input.organizationId,
              customerCredentialId: null,
            })
            .onConflictDoNothing()
            .returning();
          return decode(rows[0]);
        }, mapRepositoryError),
        findByOrganization: Effect.fn("database.providerConnections.findByOrganization")(function* (
          organizationId,
          providerAppId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.providerConnections.findFirst({
            where: {
              organizationId: { eq: organizationId },
              provider: { eq: "1claw" },
              providerAppId: { eq: providerAppId },
            },
          });
          return decode(row);
        }, mapRepositoryError),
        acquireLease: Effect.fn("database.providerConnections.acquireLease")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(providerConnections)
            .set({
              leaseToken: input.leaseToken,
              leaseExpiresAt: sql`now() + interval '60 seconds'`,
            })
            .where(
              and(
                scope(input),
                ne(providerConnections.status, "disabled"),
                or(
                  isNull(providerConnections.leaseToken),
                  sql`${providerConnections.leaseExpiresAt} <= now()`,
                ),
              ),
            )
            .returning({ id: providerConnections.id });
          return rows.length === 1;
        }, mapRepositoryError),
        releaseLease: Effect.fn("database.providerConnections.releaseLease")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(providerConnections)
            .set({ leaseToken: null, leaseExpiresAt: null })
            .where(and(scope(input), eq(providerConnections.leaseToken, input.leaseToken)))
            .returning({ id: providerConnections.id });
          return rows.length === 1;
        }, mapRepositoryError),
        reconcileIdentity: Effect.fn("database.providerConnections.reconcileIdentity")(function* (
          input,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(providerConnections)
            .set({
              externalConnectionId: input.externalConnectionId,
              data: sql`jsonb_set(${providerConnections.data}, '{customerId}', to_jsonb(${input.customerId}::text))`,
            })
            .where(
              and(
                ownedLease(input),
                eq(providerConnections.status, "pending"),
                or(
                  isNull(providerConnections.externalConnectionId),
                  and(
                    eq(providerConnections.externalConnectionId, input.externalConnectionId),
                    sql`${providerConnections.data}->>'customerId' = ${input.customerId}`,
                  ),
                ),
              ),
            )
            .returning();
          return decode(rows[0]);
        }, mapRepositoryError),
        recordBootstrap: Effect.fn("database.providerConnections.recordBootstrap")(function* (
          input,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(providerConnections)
            .set({
              data: sql`jsonb_set(${providerConnections.data}, '{bootstrapCompletedAt}', to_jsonb(now()))`,
            })
            .where(
              and(
                ownedLease(input),
                eq(providerConnections.status, "pending"),
                sql`${providerConnections.externalConnectionId} IS NOT NULL`,
                sql`${providerConnections.data}->>'bootstrapCompletedAt' IS NULL`,
              ),
            )
            .returning();
          return decode(rows[0]);
        }, mapRepositoryError),
        attachCustomerCredential: Effect.fn(
          "database.providerConnections.attachCustomerCredential",
        )(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(providerConnections)
            .set({ customerCredentialId: input.credentialId })
            .where(
              and(
                ownedLease(input),
                isNull(providerConnections.customerCredentialId),
                sql`EXISTS (SELECT 1 FROM ${credentials} WHERE ${credentials.id} = ${input.credentialId} AND ${credentials.organizationId} = ${providerConnections.organizationId} AND ${credentials.type} = '1claw-customer' AND ${credentials.data}->>'providerConnectionId' = ${providerConnections.id} AND ${credentials.data}->>'providerAppId' = ${providerConnections.providerAppId} AND ${credentials.data}->>'externalConnectionId' = ${providerConnections.externalConnectionId} AND ${credentials.data}->>'customerId' = ${providerConnections.data}->>'customerId')`,
              ),
            )
            .returning();
          return decode(rows[0]);
        }, mapRepositoryError),
        markReady: Effect.fn("database.providerConnections.markReady")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(providerConnections)
            .set({
              status: "ready",
              data: sql`jsonb_set(${providerConnections.data}, '{delegationEnabledAt}', to_jsonb(now()))`,
            })
            .where(
              and(
                ownedLease(input),
                eq(providerConnections.status, "pending"),
                sql`${providerConnections.customerCredentialId} IS NOT NULL`,
                sql`${providerConnections.data}->>'bootstrapCompletedAt' IS NOT NULL`,
              ),
            )
            .returning();
          return decode(rows[0]);
        }, mapRepositoryError),
        disable: Effect.fn("database.providerConnections.disable")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(providerConnections)
            .set({ status: "disabled", leaseToken: null, leaseExpiresAt: null })
            .where(scope(input))
            .returning();
          return decode(rows[0]);
        }, mapRepositoryError),
      });
    }),
  );
}
