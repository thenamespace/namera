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
import { and, desc, eq, exists, isNull, inArray, notExists } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import {
  sessionKey,
  sessionKeyGrant,
  sessionKeyInstallation,
  sessionKeyOperation,
} from "#/schema/index";

export interface SessionKeyRepositoryService {
  readonly insert: (data: SessionKeyInsert) => Effect.Effect<SessionKeyModel, DatabaseError>;
  readonly activate: (
    id: SessionKeyId,
    organizationId: OrganizationId,
  ) => Effect.Effect<SessionKeyModel | undefined, DatabaseError>;
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
  readonly beginRevocation: (
    id: SessionKeyId,
    organizationId: OrganizationId,
    revokedByActorId: ActorId,
    revokedAt: DateTime.Utc,
  ) => Effect.Effect<SessionKeyModel | undefined, DatabaseError>;
  readonly finishRevocation: (
    id: SessionKeyId,
    organizationId: OrganizationId,
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
            .values({
              ...encoded,
              id: data.id,
              organizationId: data.organizationId,
              walletId: data.walletId,
              signingKeyId: data.signingKeyId,
              createdByActorId: data.createdByActorId,
              revokedByActorId: data.revokedByActorId,
            })
            .returning();
          return Schema.decodeUnknownSync(SessionKey)(rows[0]);
        }, mapRepositoryError),
        activate: Effect.fn("database.sessionKeyRepository.activate")(function* (
          id,
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const installed = db
            .select({ id: sessionKeyInstallation.id })
            .from(sessionKeyInstallation)
            .where(
              and(
                eq(sessionKeyInstallation.organizationId, organizationId),
                eq(sessionKeyInstallation.sessionKeyId, id),
                eq(sessionKeyInstallation.status, "installed"),
              ),
            );
          const rows = yield* db
            .update(sessionKey)
            .set({ status: "active" })
            .where(
              and(
                eq(sessionKey.id, id),
                eq(sessionKey.organizationId, organizationId),
                eq(sessionKey.status, "pending"),
                exists(installed),
              ),
            )
            .returning();
          return rows[0] === undefined ? undefined : Schema.decodeSync(SessionKey)(rows[0]);
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
          return row === undefined ? undefined : Schema.decodeSync(SessionKey)(row);
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
          return rows.map((row) => Schema.decodeSync(SessionKey)(row));
        }, mapRepositoryError),
        findForOrganization: Effect.fn("database.sessionKeyRepository.findForOrganization")(
          function* (organizationId) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(sessionKey)
              .where(eq(sessionKey.organizationId, organizationId))
              .orderBy(desc(sessionKey.createdAt), desc(sessionKey.id));
            return rows.map((row) => Schema.decodeSync(SessionKey)(row));
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
            : Schema.decodeSync(SessionKey)(rows[0].sessionKey);
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
          return rows.map((row) => Schema.decodeSync(SessionKey)(row.sessionKey));
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
            return rows.map((row) => Schema.decodeSync(SessionKey)(row.sessionKey));
          },
          mapRepositoryError,
        ),
        beginRevocation: Effect.fn("database.sessionKeyRepository.beginRevocation")(function* (
          id,
          organizationId,
          revokedByActorId,
          revokedAt,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(sessionKey)
            .set({
              status: "revoking",
              revokedAt: Schema.encodeSync(Schema.DateTimeUtcFromDate)(revokedAt),
              revokedByActorId,
            })
            .where(
              and(
                eq(sessionKey.id, id),
                eq(sessionKey.organizationId, organizationId),
                inArray(sessionKey.status, ["active", "pending"]),
              ),
            )
            .returning();
          return rows[0] === undefined ? undefined : Schema.decodeSync(SessionKey)(rows[0]);
        }, mapRepositoryError),
        finishRevocation: Effect.fn("database.sessionKeyRepository.finishRevocation")(function* (
          id,
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const installed = db
            .select({ id: sessionKeyInstallation.id })
            .from(sessionKeyInstallation)
            .where(
              and(
                eq(sessionKeyInstallation.organizationId, organizationId),
                eq(sessionKeyInstallation.sessionKeyId, id),
                inArray(sessionKeyInstallation.status, ["submitted", "installed", "revoking"]),
              ),
            );
          const signed = db
            .select({ id: sessionKeyOperation.id })
            .from(sessionKeyOperation)
            .innerJoin(
              sessionKeyInstallation,
              and(
                eq(sessionKeyInstallation.id, sessionKeyOperation.installationId),
                eq(sessionKeyInstallation.organizationId, sessionKeyOperation.organizationId),
              ),
            )
            .where(
              and(
                eq(sessionKeyOperation.organizationId, organizationId),
                eq(sessionKeyInstallation.sessionKeyId, id),
                inArray(sessionKeyOperation.status, ["signed", "submitted"]),
              ),
            );
          const rows = yield* db
            .update(sessionKey)
            .set({ status: "revoked" })
            .where(
              and(
                eq(sessionKey.id, id),
                eq(sessionKey.organizationId, organizationId),
                eq(sessionKey.status, "revoking"),
                notExists(installed),
                notExists(signed),
              ),
            )
            .returning();
          return rows[0] === undefined ? undefined : Schema.decodeSync(SessionKey)(rows[0]);
        }, mapRepositoryError),
      });
    }),
  );
}
