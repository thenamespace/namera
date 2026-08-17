// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type {
  ActorId,
  DatabaseError,
  OAuthAuthorizationId,
  OrganizationId,
} from "@namera-ai/protocol";
import {
  OAuthAuthorization,
  OAuthAuthorizationInsert,
  type OAuthAuthorization as OAuthAuthorizationModel,
  type OAuthAuthorizationType,
} from "@namera-ai/protocol/model";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { oauthAuthorization } from "#/schema/index";

export interface OAuthAuthorizationRepositoryService {
  readonly insert: (
    data: OAuthAuthorizationInsert,
  ) => Effect.Effect<OAuthAuthorizationModel, DatabaseError>;
  readonly findActiveById: (
    id: OAuthAuthorizationId,
    now: DateTime.Utc,
  ) => Effect.Effect<OAuthAuthorizationModel | undefined, DatabaseError>;
  readonly findById: (
    id: OAuthAuthorizationId,
    organizationId: OrganizationId,
  ) => Effect.Effect<OAuthAuthorizationModel | undefined, DatabaseError>;
  readonly findForOrganization: (
    organizationId: OrganizationId,
    type?: OAuthAuthorizationType,
  ) => Effect.Effect<ReadonlyArray<OAuthAuthorizationModel>, DatabaseError>;
  readonly revoke: (params: {
    id: OAuthAuthorizationId;
    organizationId: OrganizationId;
    revokedByActorId: ActorId;
    revokedAt: DateTime.Utc;
  }) => Effect.Effect<OAuthAuthorizationModel | undefined, DatabaseError>;
  readonly touchLastUsed: (
    id: OAuthAuthorizationId,
    usedAt: DateTime.Utc,
  ) => Effect.Effect<void, DatabaseError>;
}

export class OAuthAuthorizationRepository extends Context.Service<
  OAuthAuthorizationRepository,
  OAuthAuthorizationRepositoryService
>()("@namera-ai/database/OAuthAuthorizationRepository") {
  static readonly layer: Layer.Layer<OAuthAuthorizationRepository, never, Database> = Layer.effect(
    OAuthAuthorizationRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return OAuthAuthorizationRepository.of({
        insert: Effect.fn("database.oauthAuthorizationRepository.insert")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(OAuthAuthorizationInsert)(data);
          const rows = yield* db
            .insert(oauthAuthorization)
            .values(encoded as any)
            .returning();
          return Schema.decodeSync(OAuthAuthorization)(rows[0]! as any);
        }, mapRepositoryError),
        findActiveById: Effect.fn("database.oauthAuthorizationRepository.findActiveById")(
          function* (id, now) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
            const rows = yield* db
              .select()
              .from(oauthAuthorization)
              .where(
                and(
                  eq(oauthAuthorization.id, id),
                  eq(oauthAuthorization.status, "active"),
                  or(
                    isNull(oauthAuthorization.expiresAt),
                    gt(oauthAuthorization.expiresAt, encodedNow),
                  ),
                ),
              )
              .limit(1);
            return rows[0] ? Schema.decodeSync(OAuthAuthorization)(rows[0] as any) : undefined;
          },
          mapRepositoryError,
        ),
        findById: Effect.fn("database.oauthAuthorizationRepository.findById")(function* (
          id,
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(oauthAuthorization)
            .where(
              and(
                eq(oauthAuthorization.id, id),
                eq(oauthAuthorization.organizationId, organizationId),
              ),
            )
            .limit(1);
          return rows[0] ? Schema.decodeSync(OAuthAuthorization)(rows[0] as any) : undefined;
        }, mapRepositoryError),
        findForOrganization: Effect.fn("database.oauthAuthorizationRepository.findForOrganization")(
          function* (organizationId, type) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(oauthAuthorization)
              .where(
                type === undefined
                  ? eq(oauthAuthorization.organizationId, organizationId)
                  : and(
                      eq(oauthAuthorization.organizationId, organizationId),
                      eq(oauthAuthorization.type, type),
                    ),
              )
              .orderBy(desc(oauthAuthorization.createdAt), desc(oauthAuthorization.id));
            return rows.map((row) => Schema.decodeSync(OAuthAuthorization)(row as any));
          },
          mapRepositoryError,
        ),
        revoke: Effect.fn("database.oauthAuthorizationRepository.revoke")(function* ({
          id,
          organizationId,
          revokedByActorId,
          revokedAt,
        }) {
          const db = yield* transactionOrDatabase(database);
          const encodedRevokedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(revokedAt);
          const rows = yield* db
            .update(oauthAuthorization)
            .set({ status: "revoked", revokedByActorId, revokedAt: encodedRevokedAt })
            .where(
              and(
                eq(oauthAuthorization.id, id),
                eq(oauthAuthorization.organizationId, organizationId),
                eq(oauthAuthorization.status, "active"),
              ),
            )
            .returning();
          return rows[0] ? Schema.decodeSync(OAuthAuthorization)(rows[0] as any) : undefined;
        }, mapRepositoryError),
        touchLastUsed: Effect.fn("database.oauthAuthorizationRepository.touchLastUsed")(function* (
          id,
          usedAt,
        ) {
          const db = yield* transactionOrDatabase(database);
          const encodedUsedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(usedAt);
          yield* db
            .update(oauthAuthorization)
            .set({ lastUsedAt: encodedUsedAt })
            .where(and(eq(oauthAuthorization.id, id), eq(oauthAuthorization.status, "active")));
        }, mapRepositoryError),
      });
    }),
  );
}
