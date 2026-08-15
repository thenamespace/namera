// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError } from "@namera-ai/protocol";
import {
  OAuthAuthorizationCode,
  OAuthAuthorizationCodeInsert,
  type OAuthAuthorizationCode as OAuthAuthorizationCodeModel,
} from "@namera-ai/protocol/model";
import { and, eq, gt, isNull } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { oauthAuthorizationCode } from "#/schema/index";

export interface OAuthAuthorizationCodeRepositoryService {
  readonly insert: (
    data: OAuthAuthorizationCodeInsert,
  ) => Effect.Effect<OAuthAuthorizationCodeModel, DatabaseError>;
  readonly consumeByHash: (
    codeHash: string,
    consumedAt: DateTime.Utc,
  ) => Effect.Effect<OAuthAuthorizationCodeModel | undefined, DatabaseError>;
}

export class OAuthAuthorizationCodeRepository extends Context.Service<
  OAuthAuthorizationCodeRepository,
  OAuthAuthorizationCodeRepositoryService
>()("@namera-ai/database/OAuthAuthorizationCodeRepository") {
  static readonly layer: Layer.Layer<OAuthAuthorizationCodeRepository, never, Database> =
    Layer.effect(
      OAuthAuthorizationCodeRepository,
      Effect.gen(function* () {
        const database = yield* Database;

        return OAuthAuthorizationCodeRepository.of({
          insert: Effect.fn("database.oauthAuthorizationCodeRepository.insert")(function* (data) {
            const db = yield* transactionOrDatabase(database);
            const encoded = Schema.encodeSync(OAuthAuthorizationCodeInsert)(data);
            const rows = yield* db
              .insert(oauthAuthorizationCode)
              .values(encoded as any)
              .returning();
            return Schema.decodeSync(OAuthAuthorizationCode)(rows[0]! as any);
          }, mapRepositoryError),
          consumeByHash: Effect.fn("database.oauthAuthorizationCodeRepository.consumeByHash")(
            function* (codeHash, consumedAt) {
              const db = yield* transactionOrDatabase(database);
              const encodedConsumedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(consumedAt);
              const rows = yield* db
                .update(oauthAuthorizationCode)
                .set({ consumedAt: encodedConsumedAt })
                .where(
                  and(
                    eq(oauthAuthorizationCode.codeHash, codeHash),
                    isNull(oauthAuthorizationCode.consumedAt),
                    gt(oauthAuthorizationCode.expiresAt, encodedConsumedAt),
                  ),
                )
                .returning();
              return rows[0]
                ? Schema.decodeSync(OAuthAuthorizationCode)(rows[0] as any)
                : undefined;
            },
            mapRepositoryError,
          ),
        });
      }),
    );
}
