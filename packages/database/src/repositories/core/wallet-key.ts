// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError, OrganizationId, WalletKeyId } from "@namera-ai/protocol";
import {
  WalletKey,
  WalletKeyInsert,
  type WalletKey as WalletKeyModel,
} from "@namera-ai/protocol/model";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { walletKey } from "#/schema/index";

export interface WalletKeyRepositoryService {
  readonly insert: (data: WalletKeyInsert) => Effect.Effect<WalletKeyModel, DatabaseError>;
  readonly findById: (
    id: WalletKeyId,
    organizationId: OrganizationId,
  ) => Effect.Effect<WalletKeyModel | undefined, DatabaseError>;
}

export class WalletKeyRepository extends Context.Service<
  WalletKeyRepository,
  WalletKeyRepositoryService
>()("@namera-ai/database/WalletKeyRepository") {
  static readonly layer: Layer.Layer<WalletKeyRepository, never, Database> = Layer.effect(
    WalletKeyRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return WalletKeyRepository.of({
        insert: Effect.fn("WalletKeyRepository.insert")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(WalletKeyInsert)(data);
          const rows = yield* db
            .insert(walletKey)
            .values(encoded as any)
            .returning();
          return Schema.decodeSync(WalletKey)(rows[0]!);
        }, mapToDatabaseError),
        findById: Effect.fn("WalletKeyRepository.findById")(function* (id, organizationId) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.walletKey.findFirst({
            where: {
              id: { eq: id },
              organizationId: { eq: organizationId },
            },
          });
          return row === undefined ? undefined : Schema.decodeSync(WalletKey)(row);
        }, mapToDatabaseError),
      });
    }),
  );
}
