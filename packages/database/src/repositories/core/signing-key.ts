import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError, OrganizationId, SigningKeyId } from "@namera-ai/protocol";
import {
  SigningKey,
  SigningKeyInsert,
  type SigningKey as SigningKeyModel,
  type SigningKeyAlgorithm,
  type SigningKeyInsert as SigningKeyInsertModel,
  type SigningKeyStatus,
} from "@namera-ai/protocol/model";
import { and, eq, ne, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { signingKey } from "#/schema/index";

export interface SigningKeyRepositoryService {
  readonly insert: (input: SigningKeyInsertModel) => Effect.Effect<SigningKeyModel, DatabaseError>;
  readonly insertIfPublicKeyAvailable: (
    input: SigningKeyInsertModel,
  ) => Effect.Effect<SigningKeyModel | undefined, DatabaseError>;
  readonly findById: (
    id: SigningKeyId,
    organizationId: OrganizationId,
  ) => Effect.Effect<SigningKeyModel | undefined, DatabaseError>;
  readonly findByPublicKey: (input: {
    readonly organizationId: OrganizationId;
    readonly algorithm: SigningKeyAlgorithm;
    readonly publicKeyHex: SigningKeyModel["publicKeyHex"];
  }) => Effect.Effect<SigningKeyModel | undefined, DatabaseError>;
  readonly setStatus: (
    id: SigningKeyId,
    organizationId: OrganizationId,
    status: SigningKeyStatus,
  ) => Effect.Effect<SigningKeyModel | undefined, DatabaseError>;
  readonly advancePasskeyCounter: (input: {
    readonly id: SigningKeyId;
    readonly organizationId: OrganizationId;
    readonly credentialId: string;
    readonly expectedCounter: number;
    readonly nextCounter: number;
  }) => Effect.Effect<SigningKeyModel | undefined, DatabaseError>;
}

const decodeSigningKey = (row: unknown): SigningKeyModel =>
  Schema.decodeUnknownSync(SigningKey)(row);

export class SigningKeyRepository extends Context.Service<
  SigningKeyRepository,
  SigningKeyRepositoryService
>()("@namera-ai/database/SigningKeyRepository") {
  static readonly layer: Layer.Layer<SigningKeyRepository, never, Database> = Layer.effect(
    SigningKeyRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return SigningKeyRepository.of({
        insert: Effect.fn("database.signingKeyRepository.insert")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(SigningKeyInsert)(input);
          const rows = yield* db
            .insert(signingKey)
            .values({ ...encoded, id: input.id, organizationId: input.organizationId })
            .returning();
          return decodeSigningKey(rows[0]);
        }, mapRepositoryError),
        insertIfPublicKeyAvailable: Effect.fn(
          "database.signingKeyRepository.insertIfPublicKeyAvailable",
        )(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(SigningKeyInsert)(input);
          const rows = yield* db
            .insert(signingKey)
            .values({ ...encoded, id: input.id, organizationId: input.organizationId })
            .onConflictDoNothing({
              target: [signingKey.organizationId, signingKey.algorithm, signingKey.publicKeyHex],
            })
            .returning();
          return rows[0] === undefined ? undefined : decodeSigningKey(rows[0]);
        }, mapRepositoryError),
        findById: Effect.fn("database.signingKeyRepository.findById")(function* (
          id,
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.signingKey.findFirst({
            where: {
              id: { eq: id },
              organizationId: { eq: organizationId },
            },
          });
          return row === undefined ? undefined : decodeSigningKey(row);
        }, mapRepositoryError),
        findByPublicKey: Effect.fn("database.signingKeyRepository.findByPublicKey")(function* (
          input,
        ) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.signingKey.findFirst({
            where: {
              organizationId: { eq: input.organizationId },
              algorithm: { eq: input.algorithm },
              publicKeyHex: { eq: input.publicKeyHex },
            },
          });
          return row === undefined ? undefined : decodeSigningKey(row);
        }, mapRepositoryError),
        advancePasskeyCounter: Effect.fn("database.signingKeyRepository.advancePasskeyCounter")(
          function* (input) {
            const db = yield* transactionOrDatabase(database);
            // Zero-only counters are valid for synced passkeys. The owning workflow
            // must consume its one-time approval in this same transaction.
            const rows = yield* db
              .update(signingKey)
              .set({
                data: sql`jsonb_set(${signingKey.data}, '{signCount}', to_jsonb(${input.nextCounter}::bigint))`,
              })
              .where(
                and(
                  eq(signingKey.id, input.id),
                  eq(signingKey.organizationId, input.organizationId),
                  eq(signingKey.status, "active"),
                  eq(signingKey.custody, "local"),
                  sql`${signingKey.data}->>'type' = 'passkey'`,
                  sql`${signingKey.data}->>'credentialId' = ${input.credentialId}`,
                  sql`(${signingKey.data}->>'signCount')::bigint = ${input.expectedCounter}`,
                  sql`${input.nextCounter}::bigint BETWEEN 0 AND 4294967295`,
                  sql`(${input.nextCounter}::bigint > ${input.expectedCounter}::bigint OR (${input.nextCounter}::bigint = 0 AND ${input.expectedCounter}::bigint = 0))`,
                ),
              )
              .returning();
            return rows[0] === undefined ? undefined : decodeSigningKey(rows[0]);
          },
          mapRepositoryError,
        ),
        setStatus: Effect.fn("database.signingKeyRepository.setStatus")(function* (
          id,
          organizationId,
          status,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(signingKey)
            .set({ status })
            .where(
              and(
                eq(signingKey.id, id),
                eq(signingKey.organizationId, organizationId),
                ne(signingKey.status, "destroyed"),
              ),
            )
            .returning();
          return rows[0] === undefined ? undefined : decodeSigningKey(rows[0]);
        }, mapRepositoryError),
      });
    }),
  );
}
