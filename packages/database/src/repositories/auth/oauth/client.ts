// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError } from "@namera-ai/protocol";
import {
  OAuthClient,
  OAuthClientInsert,
  type OAuthClient as OAuthClientModel,
} from "@namera-ai/protocol/model";
import { eq } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { oauthClient } from "#/schema/index";

export interface OAuthClientRepositoryService {
  readonly upsertMetadataSnapshot: (
    data: Omit<OAuthClientInsert, "registrationType">,
  ) => Effect.Effect<OAuthClientModel | undefined, DatabaseError>;
  readonly insertDynamic: (
    data: Omit<OAuthClientInsert, "registrationType">,
  ) => Effect.Effect<OAuthClientModel | undefined, DatabaseError>;
  readonly findByClientId: (
    clientId: string,
  ) => Effect.Effect<OAuthClientModel | undefined, DatabaseError>;
}

export class OAuthClientRepository extends Context.Service<
  OAuthClientRepository,
  OAuthClientRepositoryService
>()("@namera-ai/database/OAuthClientRepository") {
  static readonly layer: Layer.Layer<OAuthClientRepository, never, Database> = Layer.effect(
    OAuthClientRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return OAuthClientRepository.of({
        upsertMetadataSnapshot: Effect.fn("database.oauthClientRepository.upsertMetadataSnapshot")(
          function* (data) {
            const db = yield* transactionOrDatabase(database);
            const encoded = Schema.encodeSync(OAuthClientInsert)({
              ...data,
              registrationType: "metadata-document",
            });
            const rows = yield* db
              .insert(oauthClient)
              .values(encoded as any)
              .onConflictDoUpdate({
                target: oauthClient.clientId,
                set: {
                  clientName: encoded.clientName,
                  clientUri: encoded.clientUri,
                  logoUri: encoded.logoUri,
                  redirectUris: encoded.redirectUris,
                  grantTypes: encoded.grantTypes,
                  responseTypes: encoded.responseTypes,
                  tokenEndpointAuthMethod: encoded.tokenEndpointAuthMethod,
                  metadata: encoded.metadata,
                  status: encoded.status,
                  metadataExpiresAt: encoded.metadataExpiresAt,
                },
                setWhere: eq(oauthClient.registrationType, "metadata-document"),
              })
              .returning();
            return rows[0] ? Schema.decodeSync(OAuthClient)(rows[0] as any) : undefined;
          },
          mapRepositoryError,
        ),
        insertDynamic: Effect.fn("database.oauthClientRepository.insertDynamic")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(OAuthClientInsert)({
            ...data,
            registrationType: "dynamic",
          });
          const rows = yield* db
            .insert(oauthClient)
            .values(encoded as any)
            .onConflictDoNothing()
            .returning();
          return rows[0] ? Schema.decodeSync(OAuthClient)(rows[0] as any) : undefined;
        }, mapRepositoryError),
        findByClientId: Effect.fn("database.oauthClientRepository.findByClientId")(function* (
          clientId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(oauthClient)
            .where(eq(oauthClient.clientId, clientId))
            .limit(1);
          return rows[0] ? Schema.decodeSync(OAuthClient)(rows[0] as any) : undefined;
        }, mapRepositoryError),
      });
    }),
  );
}
