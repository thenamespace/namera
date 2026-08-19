// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { ActorId, ApiKeyId, DatabaseError, OrganizationId } from "@namera-ai/protocol";
import { ApiKey, ApiKeyInsert, type ApiKey as ApiKeyModel } from "@namera-ai/protocol/model";
import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { apiKey } from "#/schema/index";

export interface ApiKeyRepositoryService {
  readonly insert: (data: ApiKeyInsert) => Effect.Effect<ApiKeyModel, DatabaseError>;
  readonly findById: (
    id: ApiKeyId,
    organizationId: OrganizationId,
  ) => Effect.Effect<ApiKeyModel | undefined, DatabaseError>;
  readonly findByActorId: (
    actorId: ActorId,
    organizationId: OrganizationId,
  ) => Effect.Effect<ApiKeyModel | undefined, DatabaseError>;
  readonly findForOrganization: (
    organizationId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<ApiKeyModel>, DatabaseError>;
  readonly authenticate: (
    keyHash: string,
    now: DateTime.Utc,
  ) => Effect.Effect<ApiKeyModel | undefined, DatabaseError>;
  readonly revoke: (
    id: ApiKeyId,
    organizationId: OrganizationId,
    revokedByActorId: ActorId,
    revokedAt: DateTime.Utc,
  ) => Effect.Effect<ApiKeyModel | undefined, DatabaseError>;
}

export class ApiKeyRepository extends Context.Service<ApiKeyRepository, ApiKeyRepositoryService>()(
  "@namera-ai/database/ApiKeyRepository",
) {
  static readonly layer: Layer.Layer<ApiKeyRepository, never, Database> = Layer.effect(
    ApiKeyRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return ApiKeyRepository.of({
        insert: Effect.fn("database.apiKeyRepository.insert")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(ApiKeyInsert)(data);
          const rows = yield* db
            .insert(apiKey)
            .values(encoded as any)
            .returning();
          return Schema.decodeSync(ApiKey)(rows[0]! as any);
        }, mapRepositoryError),
        findById: Effect.fn("database.apiKeyRepository.findById")(function* (id, organizationId) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(apiKey)
            .where(and(eq(apiKey.id, id), eq(apiKey.organizationId, organizationId)))
            .limit(1);
          return rows[0] === undefined ? undefined : Schema.decodeSync(ApiKey)(rows[0] as any);
        }, mapRepositoryError),
        findByActorId: Effect.fn("database.apiKeyRepository.findByActorId")(function* (
          actorId,
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(apiKey)
            .where(and(eq(apiKey.actorId, actorId), eq(apiKey.organizationId, organizationId)))
            .limit(1);
          return rows[0] === undefined ? undefined : Schema.decodeSync(ApiKey)(rows[0] as any);
        }, mapRepositoryError),
        findForOrganization: Effect.fn("database.apiKeyRepository.findForOrganization")(function* (
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(apiKey)
            .where(eq(apiKey.organizationId, organizationId))
            .orderBy(desc(apiKey.createdAt), desc(apiKey.id));
          return rows.map((row) => Schema.decodeSync(ApiKey)(row as any));
        }, mapRepositoryError),
        authenticate: Effect.fn("database.apiKeyRepository.authenticate")(function* (keyHash, now) {
          const db = yield* transactionOrDatabase(database);
          const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
          const rows = yield* db
            .update(apiKey)
            .set({ lastUsedAt: encodedNow })
            .where(
              and(
                eq(apiKey.keyHash, keyHash),
                isNull(apiKey.revokedAt),
                gt(apiKey.expiresAt, encodedNow),
              ),
            )
            .returning();
          return rows[0] === undefined ? undefined : Schema.decodeSync(ApiKey)(rows[0] as any);
        }, mapRepositoryError),
        revoke: Effect.fn("database.apiKeyRepository.revoke")(function* (
          id,
          organizationId,
          revokedByActorId,
          revokedAt,
        ) {
          const db = yield* transactionOrDatabase(database);
          const encodedRevokedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(revokedAt);
          const rows = yield* db
            .update(apiKey)
            .set({ revokedAt: encodedRevokedAt, revokedByActorId })
            .where(
              and(
                eq(apiKey.id, id),
                eq(apiKey.organizationId, organizationId),
                isNull(apiKey.revokedAt),
              ),
            )
            .returning();
          return rows[0] === undefined ? undefined : Schema.decodeSync(ApiKey)(rows[0] as any);
        }, mapRepositoryError),
      });
    }),
  );
}
