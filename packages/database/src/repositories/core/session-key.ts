// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type {
  ActorId,
  DatabaseError,
  OrganizationId,
  SessionKeyId,
  WalletId,
} from "@namera-ai/protocol";
import {
  SessionKey,
  SessionKeyInsert,
  type SessionKey as SessionKeyModel,
} from "@namera-ai/protocol/model";
import { and, desc, eq, isNull } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { sessionKey, sessionKeyGrant } from "#/schema/index";

export interface SessionKeyRepositoryService {
  readonly insert: (data: SessionKeyInsert) => Effect.Effect<SessionKeyModel, DatabaseError>;
  readonly findById: (
    id: SessionKeyId,
    organizationId: OrganizationId,
  ) => Effect.Effect<SessionKeyModel | undefined, DatabaseError>;
  readonly findForWallet: (
    organizationId: OrganizationId,
    walletId: WalletId,
  ) => Effect.Effect<ReadonlyArray<SessionKeyModel>, DatabaseError>;
  readonly findForOrganization: (
    organizationId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<SessionKeyModel>, DatabaseError>;
  readonly findByIdForActor: (
    id: SessionKeyId,
    organizationId: OrganizationId,
    actorId: ActorId,
  ) => Effect.Effect<SessionKeyModel | undefined, DatabaseError>;
  readonly findForActor: (
    organizationId: OrganizationId,
    actorId: ActorId,
  ) => Effect.Effect<ReadonlyArray<SessionKeyModel>, DatabaseError>;
  readonly findForWalletAndActor: (
    organizationId: OrganizationId,
    walletId: WalletId,
    actorId: ActorId,
  ) => Effect.Effect<ReadonlyArray<SessionKeyModel>, DatabaseError>;
  readonly revoke: (
    id: SessionKeyId,
    organizationId: OrganizationId,
    revokedByActorId: ActorId,
    revokedAt: DateTime.Utc,
  ) => Effect.Effect<SessionKeyModel | undefined, DatabaseError>;
}

export class SessionKeyRepository extends Context.Service<
  SessionKeyRepository,
  SessionKeyRepositoryService
>()("@namera-ai/database/SessionKeyRepository") {
  static readonly layer: Layer.Layer<SessionKeyRepository, never, Database> = Layer.effect(
    SessionKeyRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return SessionKeyRepository.of({
        insert: Effect.fn("database.sessionKeyRepository.insert")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(SessionKeyInsert)(data);
          const rows = yield* db
            .insert(sessionKey)
            .values(encoded as any)
            .returning();
          return Schema.decodeSync(SessionKey)(rows[0]! as any);
        }, mapRepositoryError),
        findById: Effect.fn("database.sessionKeyRepository.findById")(function* (
          id,
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.sessionKey.findFirst({
            where: {
              id: { eq: id },
              organizationId: { eq: organizationId },
            },
          });
          return row === undefined ? undefined : Schema.decodeSync(SessionKey)(row as any);
        }, mapRepositoryError),
        findForWallet: Effect.fn("database.sessionKeyRepository.findForWallet")(function* (
          organizationId,
          walletId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(sessionKey)
            .where(
              and(eq(sessionKey.organizationId, organizationId), eq(sessionKey.walletId, walletId)),
            )
            .orderBy(desc(sessionKey.createdAt), desc(sessionKey.id));
          return rows.map((row) => Schema.decodeSync(SessionKey)(row as any));
        }, mapRepositoryError),
        findForOrganization: Effect.fn("database.sessionKeyRepository.findForOrganization")(
          function* (organizationId) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(sessionKey)
              .where(eq(sessionKey.organizationId, organizationId))
              .orderBy(desc(sessionKey.createdAt), desc(sessionKey.id));
            return rows.map((row) => Schema.decodeSync(SessionKey)(row as any));
          },
          mapRepositoryError,
        ),
        findByIdForActor: Effect.fn("database.sessionKeyRepository.findByIdForActor")(function* (
          id,
          organizationId,
          actorId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select({ sessionKey })
            .from(sessionKey)
            .innerJoin(
              sessionKeyGrant,
              and(
                eq(sessionKeyGrant.sessionKeyId, sessionKey.id),
                eq(sessionKeyGrant.organizationId, sessionKey.organizationId),
              ),
            )
            .where(
              and(
                eq(sessionKey.id, id),
                eq(sessionKey.organizationId, organizationId),
                eq(sessionKeyGrant.actorId, actorId),
                isNull(sessionKeyGrant.revokedAt),
                eq(sessionKey.status, "active"),
              ),
            )
            .limit(1);
          return rows[0] === undefined
            ? undefined
            : Schema.decodeSync(SessionKey)(rows[0].sessionKey as any);
        }, mapRepositoryError),
        findForActor: Effect.fn("database.sessionKeyRepository.findForActor")(function* (
          organizationId,
          actorId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select({ sessionKey })
            .from(sessionKey)
            .innerJoin(
              sessionKeyGrant,
              and(
                eq(sessionKeyGrant.sessionKeyId, sessionKey.id),
                eq(sessionKeyGrant.organizationId, sessionKey.organizationId),
              ),
            )
            .where(
              and(
                eq(sessionKey.organizationId, organizationId),
                eq(sessionKeyGrant.actorId, actorId),
                isNull(sessionKeyGrant.revokedAt),
                eq(sessionKey.status, "active"),
              ),
            )
            .orderBy(desc(sessionKey.createdAt), desc(sessionKey.id));
          return rows.map((row) => Schema.decodeSync(SessionKey)(row.sessionKey as any));
        }, mapRepositoryError),
        findForWalletAndActor: Effect.fn("database.sessionKeyRepository.findForWalletAndActor")(
          function* (organizationId, walletId, actorId) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select({ sessionKey })
              .from(sessionKey)
              .innerJoin(
                sessionKeyGrant,
                and(
                  eq(sessionKeyGrant.sessionKeyId, sessionKey.id),
                  eq(sessionKeyGrant.organizationId, sessionKey.organizationId),
                ),
              )
              .where(
                and(
                  eq(sessionKey.organizationId, organizationId),
                  eq(sessionKey.walletId, walletId),
                  eq(sessionKeyGrant.actorId, actorId),
                  isNull(sessionKeyGrant.revokedAt),
                  eq(sessionKey.status, "active"),
                ),
              )
              .orderBy(desc(sessionKey.createdAt), desc(sessionKey.id));
            return rows.map((row) => Schema.decodeSync(SessionKey)(row.sessionKey as any));
          },
          mapRepositoryError,
        ),
        revoke: Effect.fn("database.sessionKeyRepository.revoke")(function* (
          id,
          organizationId,
          revokedByActorId,
          revokedAt,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(sessionKey)
            .set({
              status: "revoked",
              revokedAt: Schema.encodeSync(Schema.DateTimeUtcFromDate)(revokedAt),
              revokedByActorId,
            })
            .where(
              and(
                eq(sessionKey.id, id),
                eq(sessionKey.organizationId, organizationId),
                eq(sessionKey.status, "active"),
              ),
            )
            .returning();
          return rows[0] === undefined ? undefined : Schema.decodeSync(SessionKey)(rows[0] as any);
        }, mapRepositoryError),
      });
    }),
  );
}
