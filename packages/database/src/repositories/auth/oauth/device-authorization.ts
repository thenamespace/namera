// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type {
  DatabaseError,
  OAuthAuthorizationId,
  OAuthDeviceAuthorizationId,
  OrganizationId,
  UserId,
} from "@namera-ai/protocol";
import {
  OAuthDeviceAuthorization,
  OAuthDeviceAuthorizationInsert,
  type OAuthDeviceAuthorization as OAuthDeviceAuthorizationModel,
} from "@namera-ai/protocol/model";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { oauthDeviceAuthorization } from "#/schema/index";

const decodeOAuthDeviceAuthorization = (row: unknown) =>
  Schema.decodeSync(OAuthDeviceAuthorization)(row as any);

export interface OAuthDeviceAuthorizationRepositoryService {
  readonly insert: (
    data: OAuthDeviceAuthorizationInsert,
  ) => Effect.Effect<OAuthDeviceAuthorizationModel, DatabaseError>;
  readonly findByDeviceCodeHash: (
    deviceCodeHash: string,
  ) => Effect.Effect<OAuthDeviceAuthorizationModel | undefined, DatabaseError>;
  readonly findById: (
    id: OAuthDeviceAuthorizationId,
  ) => Effect.Effect<OAuthDeviceAuthorizationModel | undefined, DatabaseError>;
  readonly findPendingByUserCodeHmac: (
    userCodeHmac: string,
    now: DateTime.Utc,
  ) => Effect.Effect<OAuthDeviceAuthorizationModel | undefined, DatabaseError>;
  readonly claim: (input: {
    readonly id: OAuthDeviceAuthorizationId;
    readonly userId: UserId;
    readonly now: DateTime.Utc;
  }) => Effect.Effect<OAuthDeviceAuthorizationModel | undefined, DatabaseError>;
  readonly approve: (input: {
    readonly id: OAuthDeviceAuthorizationId;
    readonly userId: UserId;
    readonly organizationId: OrganizationId;
    readonly authorizationId: OAuthAuthorizationId;
    readonly now: DateTime.Utc;
  }) => Effect.Effect<OAuthDeviceAuthorizationModel | undefined, DatabaseError>;
  readonly deny: (input: {
    readonly id: OAuthDeviceAuthorizationId;
    readonly userId: UserId;
    readonly now: DateTime.Utc;
  }) => Effect.Effect<OAuthDeviceAuthorizationModel | undefined, DatabaseError>;
  readonly recordPoll: (input: {
    readonly id: OAuthDeviceAuthorizationId;
    readonly now: DateTime.Utc;
    readonly pollingIntervalSeconds: number;
  }) => Effect.Effect<OAuthDeviceAuthorizationModel | undefined, DatabaseError>;
  readonly consumeApproved: (input: {
    readonly id: OAuthDeviceAuthorizationId;
    readonly now: DateTime.Utc;
  }) => Effect.Effect<OAuthDeviceAuthorizationModel | undefined, DatabaseError>;
  readonly expire: (
    id: OAuthDeviceAuthorizationId,
    now: DateTime.Utc,
  ) => Effect.Effect<void, DatabaseError>;
}

export class OAuthDeviceAuthorizationRepository extends Context.Service<
  OAuthDeviceAuthorizationRepository,
  OAuthDeviceAuthorizationRepositoryService
>()("@namera-ai/database/OAuthDeviceAuthorizationRepository") {
  static readonly layer: Layer.Layer<OAuthDeviceAuthorizationRepository, never, Database> =
    Layer.effect(
      OAuthDeviceAuthorizationRepository,
      Effect.gen(function* () {
        const database = yield* Database;

        return OAuthDeviceAuthorizationRepository.of({
          insert: Effect.fn("database.oauthDeviceAuthorizationRepository.insert")(function* (data) {
            const db = yield* transactionOrDatabase(database);
            const encoded = Schema.encodeSync(OAuthDeviceAuthorizationInsert)(data);
            const rows = yield* db
              .insert(oauthDeviceAuthorization)
              .values(encoded as any)
              .returning();
            return decodeOAuthDeviceAuthorization(rows[0]!);
          }, mapRepositoryError),

          findByDeviceCodeHash: Effect.fn(
            "database.oauthDeviceAuthorizationRepository.findByDeviceCodeHash",
          )(function* (deviceCodeHash) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(oauthDeviceAuthorization)
              .where(eq(oauthDeviceAuthorization.deviceCodeHash, deviceCodeHash))
              .limit(1);
            return rows[0] ? decodeOAuthDeviceAuthorization(rows[0]) : undefined;
          }, mapRepositoryError),

          findById: Effect.fn("database.oauthDeviceAuthorizationRepository.findById")(function* (
            id,
          ) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(oauthDeviceAuthorization)
              .where(eq(oauthDeviceAuthorization.id, id))
              .limit(1);
            return rows[0] ? decodeOAuthDeviceAuthorization(rows[0]) : undefined;
          }, mapRepositoryError),

          findPendingByUserCodeHmac: Effect.fn(
            "database.oauthDeviceAuthorizationRepository.findPendingByUserCodeHmac",
          )(function* (userCodeHmac, now) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
            const rows = yield* db
              .select()
              .from(oauthDeviceAuthorization)
              .where(
                and(
                  eq(oauthDeviceAuthorization.userCodeHmac, userCodeHmac),
                  eq(oauthDeviceAuthorization.status, "pending"),
                  gt(oauthDeviceAuthorization.expiresAt, encodedNow),
                ),
              )
              .limit(1);
            return rows[0] ? decodeOAuthDeviceAuthorization(rows[0]) : undefined;
          }, mapRepositoryError),

          claim: Effect.fn("database.oauthDeviceAuthorizationRepository.claim")(function* ({
            id,
            userId,
            now,
          }) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
            const rows = yield* db
              .update(oauthDeviceAuthorization)
              .set({ claimedByUserId: userId })
              .where(
                and(
                  eq(oauthDeviceAuthorization.id, id),
                  eq(oauthDeviceAuthorization.status, "pending"),
                  gt(oauthDeviceAuthorization.expiresAt, encodedNow),
                  or(
                    isNull(oauthDeviceAuthorization.claimedByUserId),
                    eq(oauthDeviceAuthorization.claimedByUserId, userId),
                  ),
                ),
              )
              .returning();
            return rows[0] ? decodeOAuthDeviceAuthorization(rows[0]) : undefined;
          }, mapRepositoryError),

          approve: Effect.fn("database.oauthDeviceAuthorizationRepository.approve")(function* ({
            id,
            userId,
            organizationId,
            authorizationId,
            now,
          }) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
            const rows = yield* db
              .update(oauthDeviceAuthorization)
              .set({
                status: "approved",
                organizationId,
                authorizationId,
                approvedAt: encodedNow,
              })
              .where(
                and(
                  eq(oauthDeviceAuthorization.id, id),
                  eq(oauthDeviceAuthorization.claimedByUserId, userId),
                  eq(oauthDeviceAuthorization.status, "pending"),
                  gt(oauthDeviceAuthorization.expiresAt, encodedNow),
                ),
              )
              .returning();
            return rows[0] ? decodeOAuthDeviceAuthorization(rows[0]) : undefined;
          }, mapRepositoryError),

          deny: Effect.fn("database.oauthDeviceAuthorizationRepository.deny")(function* ({
            id,
            userId,
            now,
          }) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
            const rows = yield* db
              .update(oauthDeviceAuthorization)
              .set({ status: "denied", deniedAt: encodedNow })
              .where(
                and(
                  eq(oauthDeviceAuthorization.id, id),
                  eq(oauthDeviceAuthorization.claimedByUserId, userId),
                  eq(oauthDeviceAuthorization.status, "pending"),
                  gt(oauthDeviceAuthorization.expiresAt, encodedNow),
                ),
              )
              .returning();
            return rows[0] ? decodeOAuthDeviceAuthorization(rows[0]) : undefined;
          }, mapRepositoryError),

          recordPoll: Effect.fn("database.oauthDeviceAuthorizationRepository.recordPoll")(
            function* ({ id, now, pollingIntervalSeconds }) {
              const db = yield* transactionOrDatabase(database);
              const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
              const rows = yield* db
                .update(oauthDeviceAuthorization)
                .set({ lastPolledAt: encodedNow, pollingIntervalSeconds })
                .where(eq(oauthDeviceAuthorization.id, id))
                .returning();
              return rows[0] ? decodeOAuthDeviceAuthorization(rows[0]) : undefined;
            },
            mapRepositoryError,
          ),

          consumeApproved: Effect.fn("database.oauthDeviceAuthorizationRepository.consumeApproved")(
            function* ({ id, now }) {
              const db = yield* transactionOrDatabase(database);
              const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
              const rows = yield* db
                .update(oauthDeviceAuthorization)
                .set({ status: "consumed", consumedAt: encodedNow })
                .where(
                  and(
                    eq(oauthDeviceAuthorization.id, id),
                    eq(oauthDeviceAuthorization.status, "approved"),
                    gt(oauthDeviceAuthorization.expiresAt, encodedNow),
                  ),
                )
                .returning();
              return rows[0] ? decodeOAuthDeviceAuthorization(rows[0]) : undefined;
            },
            mapRepositoryError,
          ),

          expire: Effect.fn("database.oauthDeviceAuthorizationRepository.expire")(function* (
            id,
            now,
          ) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
            yield* db
              .update(oauthDeviceAuthorization)
              .set({ status: "expired" })
              .where(
                and(
                  eq(oauthDeviceAuthorization.id, id),
                  eq(oauthDeviceAuthorization.status, "pending"),
                  lte(oauthDeviceAuthorization.expiresAt, encodedNow),
                ),
              );
          }, mapRepositoryError),
        });
      }),
    );
}
