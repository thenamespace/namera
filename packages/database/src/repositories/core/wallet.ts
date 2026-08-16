// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema } from "effect";

import type { ActorId, DatabaseError, OrganizationId, WalletId } from "@namera-ai/protocol";
import {
  Wallet,
  WalletInsert,
  WalletKey,
  type WalletMetadata,
  type Wallet as WalletModel,
  type WalletKey as WalletKeyModel,
} from "@namera-ai/protocol/model";
import { and, desc, eq, isNull } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { sessionKey, sessionKeyGrant, wallet, walletKey } from "#/schema/index";

export interface WalletView {
  readonly wallet: WalletModel;
  readonly walletKey: WalletKeyModel;
}

export interface WalletRepositoryService {
  readonly insert: (data: WalletInsert) => Effect.Effect<WalletModel, DatabaseError>;
  readonly findById: (
    id: WalletId,
    organizationId: OrganizationId,
  ) => Effect.Effect<WalletView | undefined, DatabaseError>;
  readonly findForOrganization: (
    organizationId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<WalletView>, DatabaseError>;
  readonly findByIdForActor: (
    id: WalletId,
    organizationId: OrganizationId,
    actorId: ActorId,
  ) => Effect.Effect<WalletView | undefined, DatabaseError>;
  readonly findForActor: (
    organizationId: OrganizationId,
    actorId: ActorId,
  ) => Effect.Effect<ReadonlyArray<WalletView>, DatabaseError>;
  readonly updateMetadata: (
    id: WalletId,
    organizationId: OrganizationId,
    metadata: WalletMetadata,
  ) => Effect.Effect<WalletView | undefined, DatabaseError>;
}

const decodeWalletView = (row: {
  readonly wallet: unknown;
  readonly walletKey: unknown;
}): WalletView => ({
  wallet: Schema.decodeSync(Wallet)(row.wallet as any),
  walletKey: Schema.decodeSync(WalletKey)(row.walletKey as any),
});

export class WalletRepository extends Context.Service<WalletRepository, WalletRepositoryService>()(
  "@namera-ai/database/WalletRepository",
) {
  static readonly layer: Layer.Layer<WalletRepository, never, Database> = Layer.effect(
    WalletRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return WalletRepository.of({
        insert: Effect.fn("database.walletRepository.insert")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(WalletInsert)(data);
          const rows = yield* db
            .insert(wallet)
            .values(encoded as any)
            .returning();
          return Schema.decodeSync(Wallet)(rows[0]! as any);
        }, mapRepositoryError),
        findById: Effect.fn("database.walletRepository.findById")(function* (id, organizationId) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.wallet.findFirst({
            where: {
              id: { eq: id },
              organizationId: { eq: organizationId },
            },
            with: { walletKey: true },
          });
          if (row === undefined) return undefined;
          const { walletKey: key, ...walletRow } = row;
          return decodeWalletView({ wallet: walletRow, walletKey: key });
        }, mapRepositoryError),
        findForOrganization: Effect.fn("database.walletRepository.findForOrganization")(function* (
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select({ wallet, walletKey })
            .from(wallet)
            .innerJoin(walletKey, eq(wallet.walletKeyId, walletKey.id))
            .where(eq(wallet.organizationId, organizationId))
            .orderBy(desc(wallet.createdAt), desc(wallet.id));
          return rows.map(decodeWalletView);
        }, mapRepositoryError),
        findByIdForActor: Effect.fn("database.walletRepository.findByIdForActor")(function* (
          id,
          organizationId,
          actorId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select({ wallet, walletKey })
            .from(wallet)
            .innerJoin(walletKey, eq(wallet.walletKeyId, walletKey.id))
            .innerJoin(
              sessionKey,
              and(
                eq(sessionKey.walletId, wallet.id),
                eq(sessionKey.organizationId, wallet.organizationId),
              ),
            )
            .innerJoin(
              sessionKeyGrant,
              and(
                eq(sessionKeyGrant.sessionKeyId, sessionKey.id),
                eq(sessionKeyGrant.organizationId, sessionKey.organizationId),
              ),
            )
            .where(
              and(
                eq(wallet.id, id),
                eq(wallet.organizationId, organizationId),
                eq(sessionKeyGrant.actorId, actorId),
                isNull(sessionKeyGrant.revokedAt),
                eq(sessionKey.status, "active"),
              ),
            )
            .limit(1);
          return rows[0] === undefined ? undefined : decodeWalletView(rows[0]);
        }, mapRepositoryError),
        findForActor: Effect.fn("database.walletRepository.findForActor")(function* (
          organizationId,
          actorId,
        ) {
          const db = yield* transactionOrDatabase(database);

          // A wallet is visible to a machine actor only through at least one live session-key grant.
          const rows = yield* db
            .select({ wallet, walletKey })
            .from(wallet)
            .innerJoin(walletKey, eq(wallet.walletKeyId, walletKey.id))
            .innerJoin(
              sessionKey,
              and(
                eq(sessionKey.walletId, wallet.id),
                eq(sessionKey.organizationId, wallet.organizationId),
              ),
            )
            .innerJoin(
              sessionKeyGrant,
              and(
                eq(sessionKeyGrant.sessionKeyId, sessionKey.id),
                eq(sessionKeyGrant.organizationId, sessionKey.organizationId),
              ),
            )
            .where(
              and(
                eq(wallet.organizationId, organizationId),
                eq(sessionKeyGrant.actorId, actorId),
                isNull(sessionKeyGrant.revokedAt),
                eq(sessionKey.status, "active"),
              ),
            )
            .orderBy(desc(wallet.createdAt), desc(wallet.id));
          const uniqueWallets = new Map<WalletId, WalletView>();
          for (const row of rows) {
            if (!uniqueWallets.has(row.wallet.id)) {
              uniqueWallets.set(row.wallet.id, decodeWalletView(row));
            }
          }
          return [...uniqueWallets.values()];
        }, mapRepositoryError),
        updateMetadata: Effect.fn("database.walletRepository.updateMetadata")(function* (
          id,
          organizationId,
          metadata,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(wallet)
            .set({ metadata })
            .where(and(eq(wallet.id, id), eq(wallet.organizationId, organizationId)))
            .returning();
          const updated = rows[0];
          if (updated === undefined) return undefined;
          const key = yield* db.query.walletKey.findFirst({
            where: {
              id: { eq: updated.walletKeyId },
              organizationId: { eq: organizationId },
            },
          });
          if (key === undefined) return yield* Effect.die("Updated wallet key relation is missing");
          return decodeWalletView({ wallet: updated, walletKey: key });
        }, mapRepositoryError),
      });
    }),
  );
}
