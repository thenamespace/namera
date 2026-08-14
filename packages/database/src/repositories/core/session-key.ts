// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError, OrganizationId, SessionKeyId, WalletId } from "@namera-ai/protocol";
import {
  SessionKey,
  SessionKeyInsert,
  type SessionKey as SessionKeyModel,
} from "@namera-ai/protocol/model";
import { and, desc, eq } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { sessionKey } from "#/schema/index";

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
      });
    }),
  );
}
