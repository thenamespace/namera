import { Context, DateTime, Effect, Layer, Schema } from "effect";

import {
  DatabaseError,
  type CredentialId,
  type OrganizationId,
  type ProviderConnectionId,
} from "@namera-ai/protocol";
import { Credential, CredentialInsert } from "@namera-ai/protocol/model";
import { and, eq, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { credentials, providerConnections } from "#/schema/index";

export interface CredentialsRepositoryService {
  readonly findCustomerAuthorization: (
    connectionId: ProviderConnectionId,
    organizationId: OrganizationId,
  ) => Effect.Effect<Credential | undefined, DatabaseError>;
  readonly setAuthorizationStatus: (input: {
    readonly id: CredentialId;
    readonly organizationId: OrganizationId;
    readonly leaseToken: string;
    readonly status: "ready" | "recovery_required";
  }) => Effect.Effect<boolean, DatabaseError>;
  readonly replaceCustomerToken: (input: {
    readonly id: CredentialId;
    readonly organizationId: OrganizationId;
    readonly expectedEncryptedPayload: string;
    readonly encryptedPayload: string;
    readonly expiresAt: DateTime.Utc;
    readonly leaseToken: string;
  }) => Effect.Effect<Credential | undefined, DatabaseError>;
  readonly insert: (input: CredentialInsert) => Effect.Effect<Credential, DatabaseError>;
  readonly findById: (
    id: CredentialId,
    organizationId: OrganizationId,
  ) => Effect.Effect<Credential | undefined, DatabaseError>;
}

export class CredentialsRepository extends Context.Service<
  CredentialsRepository,
  CredentialsRepositoryService
>()("@namera-ai/database/CredentialsRepository") {
  static readonly layer: Layer.Layer<CredentialsRepository, never, Database> = Layer.effect(
    CredentialsRepository,
    Effect.gen(function* () {
      const database = yield* Database;
      return CredentialsRepository.of({
        findCustomerAuthorization: Effect.fn("database.credentials.findCustomerAuthorization")(
          function* (connectionId, organizationId) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(credentials)
              .where(
                and(
                  eq(credentials.organizationId, organizationId),
                  eq(credentials.type, "1claw-customer-authorization"),
                  sql`${credentials.data}->>'providerConnectionId' = ${connectionId}`,
                ),
              );
            return rows[0] ? Schema.decodeUnknownSync(Credential)(rows[0]) : undefined;
          },
          mapRepositoryError,
        ),
        setAuthorizationStatus: Effect.fn("database.credentials.setAuthorizationStatus")(function* (
          input,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(credentials)
            .set({
              data: sql`jsonb_set(${credentials.data}, '{status}', to_jsonb(${input.status}::text))`,
            })
            .where(
              and(
                eq(credentials.id, input.id),
                eq(credentials.organizationId, input.organizationId),
                eq(credentials.type, "1claw-customer-authorization"),
                sql`${credentials.data}->>'status' = 'pending'`,
                sql`EXISTS (SELECT 1 FROM ${providerConnections} WHERE ${providerConnections.id} = ${credentials.data}->>'providerConnectionId' AND ${providerConnections.organizationId} = ${credentials.organizationId} AND ${providerConnections.status} <> 'disabled' AND ${providerConnections.leaseToken} = ${input.leaseToken} AND ${providerConnections.leaseExpiresAt} > clock_timestamp() FOR UPDATE)`,
              ),
            )
            .returning({ id: credentials.id });
          return rows.length === 1;
        }, mapRepositoryError),
        replaceCustomerToken: Effect.fn("database.credentialsRepository.replaceCustomerToken")(
          function* (input) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .update(credentials)
              .set({
                encryptedPayload: input.encryptedPayload,
                expiresAt: DateTime.toDateUtc(input.expiresAt),
              })
              .where(
                and(
                  eq(credentials.id, input.id),
                  eq(credentials.organizationId, input.organizationId),
                  eq(credentials.type, "1claw-customer"),
                  eq(credentials.encryptedPayload, input.expectedEncryptedPayload),
                  sql`${DateTime.toDateUtc(input.expiresAt)}::timestamptz > now()`,
                  sql`EXISTS (SELECT 1 FROM ${providerConnections} WHERE ${providerConnections.customerCredentialId} = ${credentials.id} AND ${providerConnections.organizationId} = ${credentials.organizationId} AND ${providerConnections.status} <> 'disabled' AND ${providerConnections.leaseToken} = ${input.leaseToken} AND ${providerConnections.leaseExpiresAt} > now() FOR UPDATE)`,
                ),
              )
              .returning();
            return rows[0] === undefined
              ? undefined
              : Schema.decodeUnknownSync(Credential)(rows[0]);
          },
          mapRepositoryError,
          Effect.mapError(
            () =>
              new DatabaseError({
                cause: new Error("Customer credential replacement failed"),
                message: "Customer credential replacement failed",
              }),
          ),
        ),
        insert: Effect.fn("database.credentialsRepository.insert")(
          function* (input) {
            const db = yield* transactionOrDatabase(database);
            const encoded = Schema.encodeSync(CredentialInsert)(input);
            const rows = yield* db
              .insert(credentials)
              .values({
                ...encoded,
                id: input.id,
                organizationId: input.organizationId,
                type: input.type,
                data: input.data,
                expiresAt:
                  input.type === "1claw-customer" ? DateTime.toDateUtc(input.expiresAt) : null,
              })
              .returning();
            return Schema.decodeUnknownSync(Credential)(rows[0]);
          },
          mapRepositoryError,
          Effect.mapError(
            () =>
              new DatabaseError({
                // Driver failures can retain bound ciphertext in their query parameters.
                cause: new Error("Credential insert failed"),
                message: "Credential insert failed",
              }),
          ),
        ),
        findById: Effect.fn("database.credentialsRepository.findById")(function* (
          id,
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.credentials.findFirst({
            where: { id: { eq: id }, organizationId: { eq: organizationId } },
          });
          return row === undefined ? undefined : Schema.decodeUnknownSync(Credential)(row);
        }, mapRepositoryError),
      });
    }),
  );
}
