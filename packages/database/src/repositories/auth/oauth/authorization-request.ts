// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type {
  DatabaseError,
  OAuthAuthorizationRequestId,
  OrganizationId,
  UserId,
} from "@namera-ai/protocol";
import {
  OAuthAuthorizationRequest,
  OAuthAuthorizationRequestInsert,
  type OAuthAuthorizationRequest as OAuthAuthorizationRequestModel,
} from "@namera-ai/protocol/model";
import { and, eq, gt } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { oauthAuthorizationRequest } from "#/schema/index";

export interface OAuthAuthorizationRequestRepositoryService {
  readonly insert: (
    data: OAuthAuthorizationRequestInsert,
  ) => Effect.Effect<OAuthAuthorizationRequestModel, DatabaseError>;
  readonly findPendingById: (
    id: OAuthAuthorizationRequestId,
    now: DateTime.Utc,
  ) => Effect.Effect<OAuthAuthorizationRequestModel | undefined, DatabaseError>;
  readonly approve: (params: {
    id: OAuthAuthorizationRequestId;
    userId: UserId;
    organizationId: OrganizationId;
    now: DateTime.Utc;
  }) => Effect.Effect<OAuthAuthorizationRequestModel | undefined, DatabaseError>;
  readonly deny: (params: {
    id: OAuthAuthorizationRequestId;
    userId: UserId;
    now: DateTime.Utc;
  }) => Effect.Effect<OAuthAuthorizationRequestModel | undefined, DatabaseError>;
}

export class OAuthAuthorizationRequestRepository extends Context.Service<
  OAuthAuthorizationRequestRepository,
  OAuthAuthorizationRequestRepositoryService
>()("@namera-ai/database/OAuthAuthorizationRequestRepository") {
  static readonly layer: Layer.Layer<OAuthAuthorizationRequestRepository, never, Database> =
    Layer.effect(
      OAuthAuthorizationRequestRepository,
      Effect.gen(function* () {
        const database = yield* Database;

        return OAuthAuthorizationRequestRepository.of({
          insert: Effect.fn("database.oauthAuthorizationRequestRepository.insert")(function* (
            data,
          ) {
            const db = yield* transactionOrDatabase(database);
            const encoded = Schema.encodeSync(OAuthAuthorizationRequestInsert)(data);
            const rows = yield* db
              .insert(oauthAuthorizationRequest)
              .values(encoded as any)
              .returning();
            return Schema.decodeSync(OAuthAuthorizationRequest)(rows[0]! as any);
          }, mapRepositoryError),
          findPendingById: Effect.fn(
            "database.oauthAuthorizationRequestRepository.findPendingById",
          )(function* (id, now) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
            const rows = yield* db
              .select()
              .from(oauthAuthorizationRequest)
              .where(
                and(
                  eq(oauthAuthorizationRequest.id, id),
                  eq(oauthAuthorizationRequest.status, "pending"),
                  gt(oauthAuthorizationRequest.expiresAt, encodedNow),
                ),
              )
              .limit(1);
            return rows[0]
              ? Schema.decodeSync(OAuthAuthorizationRequest)(rows[0] as any)
              : undefined;
          }, mapRepositoryError),
          approve: Effect.fn("database.oauthAuthorizationRequestRepository.approve")(function* ({
            id,
            userId,
            organizationId,
            now,
          }) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
            const rows = yield* db
              .update(oauthAuthorizationRequest)
              .set({ userId, organizationId, status: "approved", approvedAt: encodedNow })
              .where(
                and(
                  eq(oauthAuthorizationRequest.id, id),
                  eq(oauthAuthorizationRequest.status, "pending"),
                  gt(oauthAuthorizationRequest.expiresAt, encodedNow),
                ),
              )
              .returning();
            return rows[0]
              ? Schema.decodeSync(OAuthAuthorizationRequest)(rows[0] as any)
              : undefined;
          }, mapRepositoryError),
          deny: Effect.fn("database.oauthAuthorizationRequestRepository.deny")(function* ({
            id,
            userId,
            now,
          }) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
            const rows = yield* db
              .update(oauthAuthorizationRequest)
              .set({ userId, status: "denied", deniedAt: encodedNow })
              .where(
                and(
                  eq(oauthAuthorizationRequest.id, id),
                  eq(oauthAuthorizationRequest.status, "pending"),
                  gt(oauthAuthorizationRequest.expiresAt, encodedNow),
                ),
              )
              .returning();
            return rows[0]
              ? Schema.decodeSync(OAuthAuthorizationRequest)(rows[0] as any)
              : undefined;
          }, mapRepositoryError),
        });
      }),
    );
}
