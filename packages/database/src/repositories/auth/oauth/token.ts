// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError, McpAuthorizationId, OAuthTokenFamilyId } from "@namera-ai/protocol";
import {
  OAuthAccessTokenInsert,
  OAuthRefreshTokenInsert,
  OAuthToken,
  type OAuthAccessTokenInsert as OAuthAccessTokenInsertModel,
  type OAuthRefreshTokenInsert as OAuthRefreshTokenInsertModel,
  type OAuthToken as OAuthTokenModel,
} from "@namera-ai/protocol/model";
import { and, eq, gt, isNull } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { oauthToken } from "#/schema/index";

export interface OAuthTokenRepositoryService {
  readonly insertAccess: (
    data: OAuthAccessTokenInsertModel,
  ) => Effect.Effect<OAuthTokenModel, DatabaseError>;
  readonly insertRefresh: (
    data: OAuthRefreshTokenInsertModel,
  ) => Effect.Effect<OAuthTokenModel, DatabaseError>;
  readonly findActiveAccessByHash: (
    tokenHash: string,
    now: DateTime.Utc,
  ) => Effect.Effect<OAuthTokenModel | undefined, DatabaseError>;
  readonly findByHash: (
    tokenHash: string,
  ) => Effect.Effect<OAuthTokenModel | undefined, DatabaseError>;
  readonly touchLastUsed: (
    id: OAuthTokenModel["id"],
    usedAt: DateTime.Utc,
  ) => Effect.Effect<void, DatabaseError>;
  readonly consumeRefreshByHash: (
    tokenHash: string,
    consumedAt: DateTime.Utc,
  ) => Effect.Effect<OAuthTokenModel | undefined, DatabaseError>;
  readonly revokeAuthorization: (
    authorizationId: McpAuthorizationId,
    revokedAt: DateTime.Utc,
  ) => Effect.Effect<ReadonlyArray<OAuthTokenModel>, DatabaseError>;
  readonly revokeByHash: (
    tokenHash: string,
    revokedAt: DateTime.Utc,
  ) => Effect.Effect<OAuthTokenModel | undefined, DatabaseError>;
  readonly revokeFamily: (
    familyId: OAuthTokenFamilyId,
    revokedAt: DateTime.Utc,
  ) => Effect.Effect<ReadonlyArray<OAuthTokenModel>, DatabaseError>;
}

export class OAuthTokenRepository extends Context.Service<
  OAuthTokenRepository,
  OAuthTokenRepositoryService
>()("@namera-ai/database/OAuthTokenRepository") {
  static readonly layer: Layer.Layer<OAuthTokenRepository, never, Database> = Layer.effect(
    OAuthTokenRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return OAuthTokenRepository.of({
        insertAccess: Effect.fn("database.oauthTokenRepository.insertAccess")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(OAuthAccessTokenInsert)(data);
          const rows = yield* db
            .insert(oauthToken)
            .values(encoded as any)
            .returning();
          return Schema.decodeSync(OAuthToken)(rows[0]! as any);
        }, mapRepositoryError),
        insertRefresh: Effect.fn("database.oauthTokenRepository.insertRefresh")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(OAuthRefreshTokenInsert)(data);
          const rows = yield* db
            .insert(oauthToken)
            .values(encoded as any)
            .returning();
          return Schema.decodeSync(OAuthToken)(rows[0]! as any);
        }, mapRepositoryError),
        findActiveAccessByHash: Effect.fn("database.oauthTokenRepository.findActiveAccessByHash")(
          function* (tokenHash, now) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
            const rows = yield* db
              .select()
              .from(oauthToken)
              .where(
                and(
                  eq(oauthToken.tokenHash, tokenHash),
                  eq(oauthToken.type, "access"),
                  isNull(oauthToken.revokedAt),
                  gt(oauthToken.expiresAt, encodedNow),
                ),
              )
              .limit(1);
            return rows[0] ? Schema.decodeSync(OAuthToken)(rows[0] as any) : undefined;
          },
          mapRepositoryError,
        ),
        findByHash: Effect.fn("database.oauthTokenRepository.findByHash")(function* (tokenHash) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(oauthToken)
            .where(eq(oauthToken.tokenHash, tokenHash))
            .limit(1);
          return rows[0] ? Schema.decodeSync(OAuthToken)(rows[0] as any) : undefined;
        }, mapRepositoryError),
        touchLastUsed: Effect.fn("database.oauthTokenRepository.touchLastUsed")(function* (
          id,
          usedAt,
        ) {
          const db = yield* transactionOrDatabase(database);
          const encodedUsedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(usedAt);
          yield* db
            .update(oauthToken)
            .set({ lastUsedAt: encodedUsedAt })
            .where(and(eq(oauthToken.id, id), eq(oauthToken.type, "access")));
        }, mapRepositoryError),
        consumeRefreshByHash: Effect.fn("database.oauthTokenRepository.consumeRefreshByHash")(
          function* (tokenHash, consumedAt) {
            const db = yield* transactionOrDatabase(database);
            const encodedConsumedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(consumedAt);
            const rows = yield* db
              .update(oauthToken)
              .set({ consumedAt: encodedConsumedAt })
              .where(
                and(
                  eq(oauthToken.tokenHash, tokenHash),
                  eq(oauthToken.type, "refresh"),
                  isNull(oauthToken.consumedAt),
                  isNull(oauthToken.revokedAt),
                  gt(oauthToken.expiresAt, encodedConsumedAt),
                ),
              )
              .returning();
            return rows[0] ? Schema.decodeSync(OAuthToken)(rows[0] as any) : undefined;
          },
          mapRepositoryError,
        ),
        revokeAuthorization: Effect.fn("database.oauthTokenRepository.revokeAuthorization")(
          function* (authorizationId, revokedAt) {
            const db = yield* transactionOrDatabase(database);
            const encodedRevokedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(revokedAt);
            const rows = yield* db
              .update(oauthToken)
              .set({ revokedAt: encodedRevokedAt })
              .where(
                and(eq(oauthToken.authorizationId, authorizationId), isNull(oauthToken.revokedAt)),
              )
              .returning();
            return rows.map((row) => Schema.decodeSync(OAuthToken)(row as any));
          },
          mapRepositoryError,
        ),
        revokeByHash: Effect.fn("database.oauthTokenRepository.revokeByHash")(function* (
          tokenHash,
          revokedAt,
        ) {
          const db = yield* transactionOrDatabase(database);
          const encodedRevokedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(revokedAt);
          const rows = yield* db
            .update(oauthToken)
            .set({ revokedAt: encodedRevokedAt })
            .where(and(eq(oauthToken.tokenHash, tokenHash), isNull(oauthToken.revokedAt)))
            .returning();
          return rows[0] ? Schema.decodeSync(OAuthToken)(rows[0] as any) : undefined;
        }, mapRepositoryError),
        revokeFamily: Effect.fn("database.oauthTokenRepository.revokeFamily")(function* (
          familyId,
          revokedAt,
        ) {
          const db = yield* transactionOrDatabase(database);
          const encodedRevokedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(revokedAt);
          const rows = yield* db
            .update(oauthToken)
            .set({ revokedAt: encodedRevokedAt })
            .where(and(eq(oauthToken.familyId, familyId), isNull(oauthToken.revokedAt)))
            .returning();
          return rows.map((row) => Schema.decodeSync(OAuthToken)(row as any));
        }, mapRepositoryError),
      });
    }),
  );
}
