// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type {
  ActorId,
  DatabaseError,
  McpAuthorizationId,
  OrganizationId,
} from "@namera-ai/protocol";
import {
  McpAuthorization,
  McpAuthorizationInsert,
  type McpAuthorization as McpAuthorizationModel,
} from "@namera-ai/protocol/model";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { mcpAuthorization } from "#/schema/index";

export interface McpAuthorizationRepositoryService {
  readonly insert: (
    data: McpAuthorizationInsert,
  ) => Effect.Effect<McpAuthorizationModel, DatabaseError>;
  readonly findActiveById: (
    id: McpAuthorizationId,
    now: DateTime.Utc,
  ) => Effect.Effect<McpAuthorizationModel | undefined, DatabaseError>;
  readonly findById: (
    id: McpAuthorizationId,
    organizationId: OrganizationId,
  ) => Effect.Effect<McpAuthorizationModel | undefined, DatabaseError>;
  readonly findForOrganization: (
    organizationId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<McpAuthorizationModel>, DatabaseError>;
  readonly revoke: (params: {
    id: McpAuthorizationId;
    organizationId: OrganizationId;
    revokedByActorId: ActorId;
    revokedAt: DateTime.Utc;
  }) => Effect.Effect<McpAuthorizationModel | undefined, DatabaseError>;
  readonly touchLastUsed: (
    id: McpAuthorizationId,
    usedAt: DateTime.Utc,
  ) => Effect.Effect<void, DatabaseError>;
}

export class McpAuthorizationRepository extends Context.Service<
  McpAuthorizationRepository,
  McpAuthorizationRepositoryService
>()("@namera-ai/database/McpAuthorizationRepository") {
  static readonly layer: Layer.Layer<McpAuthorizationRepository, never, Database> = Layer.effect(
    McpAuthorizationRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return McpAuthorizationRepository.of({
        insert: Effect.fn("database.mcpAuthorizationRepository.insert")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(McpAuthorizationInsert)(data);
          const rows = yield* db
            .insert(mcpAuthorization)
            .values(encoded as any)
            .returning();
          return Schema.decodeSync(McpAuthorization)(rows[0]! as any);
        }, mapRepositoryError),
        findActiveById: Effect.fn("database.mcpAuthorizationRepository.findActiveById")(function* (
          id,
          now,
        ) {
          const db = yield* transactionOrDatabase(database);
          const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
          const rows = yield* db
            .select()
            .from(mcpAuthorization)
            .where(
              and(
                eq(mcpAuthorization.id, id),
                eq(mcpAuthorization.status, "active"),
                or(isNull(mcpAuthorization.expiresAt), gt(mcpAuthorization.expiresAt, encodedNow)),
              ),
            )
            .limit(1);
          return rows[0] ? Schema.decodeSync(McpAuthorization)(rows[0] as any) : undefined;
        }, mapRepositoryError),
        findById: Effect.fn("database.mcpAuthorizationRepository.findById")(function* (
          id,
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(mcpAuthorization)
            .where(
              and(eq(mcpAuthorization.id, id), eq(mcpAuthorization.organizationId, organizationId)),
            )
            .limit(1);
          return rows[0] ? Schema.decodeSync(McpAuthorization)(rows[0] as any) : undefined;
        }, mapRepositoryError),
        findForOrganization: Effect.fn("database.mcpAuthorizationRepository.findForOrganization")(
          function* (organizationId) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(mcpAuthorization)
              .where(eq(mcpAuthorization.organizationId, organizationId))
              .orderBy(desc(mcpAuthorization.createdAt), desc(mcpAuthorization.id));
            return rows.map((row) => Schema.decodeSync(McpAuthorization)(row as any));
          },
          mapRepositoryError,
        ),
        revoke: Effect.fn("database.mcpAuthorizationRepository.revoke")(function* ({
          id,
          organizationId,
          revokedByActorId,
          revokedAt,
        }) {
          const db = yield* transactionOrDatabase(database);
          const encodedRevokedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(revokedAt);
          const rows = yield* db
            .update(mcpAuthorization)
            .set({ status: "revoked", revokedByActorId, revokedAt: encodedRevokedAt })
            .where(
              and(
                eq(mcpAuthorization.id, id),
                eq(mcpAuthorization.organizationId, organizationId),
                eq(mcpAuthorization.status, "active"),
              ),
            )
            .returning();
          return rows[0] ? Schema.decodeSync(McpAuthorization)(rows[0] as any) : undefined;
        }, mapRepositoryError),
        touchLastUsed: Effect.fn("database.mcpAuthorizationRepository.touchLastUsed")(function* (
          id,
          usedAt,
        ) {
          const db = yield* transactionOrDatabase(database);
          const encodedUsedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(usedAt);
          yield* db
            .update(mcpAuthorization)
            .set({ lastUsedAt: encodedUsedAt })
            .where(and(eq(mcpAuthorization.id, id), eq(mcpAuthorization.status, "active")));
        }, mapRepositoryError),
      });
    }),
  );
}
