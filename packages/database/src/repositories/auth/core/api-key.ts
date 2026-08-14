// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema } from "effect";

import type { ApiKeyId, DatabaseError, OrganizationId } from "@namera-ai/protocol";
import { ApiKey, ApiKeyInsert, type ApiKey as ApiKeyModel } from "@namera-ai/protocol/model";
import { and, desc, eq } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { apiKey } from "#/schema/index";

export interface ApiKeyRepositoryService {
  readonly insert: (data: ApiKeyInsert) => Effect.Effect<ApiKeyModel, DatabaseError>;
  readonly findById: (
    id: ApiKeyId,
    organizationId: OrganizationId,
  ) => Effect.Effect<ApiKeyModel | undefined, DatabaseError>;
  readonly findForOrganization: (
    organizationId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<ApiKeyModel>, DatabaseError>;
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
      });
    }),
  );
}
