import { Context, Effect, Layer, Schema } from "effect";

import { DatabaseError, type CredentialId, type OrganizationId } from "@namera-ai/protocol";
import { Credential, CredentialInsert } from "@namera-ai/protocol/model";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { credentials } from "#/schema/index";

export interface CredentialsRepositoryService {
  readonly insert: (input: CredentialInsert) => Effect.Effect<Credential, DatabaseError>;
  readonly findById: (
    id: CredentialId,
    organizationId: OrganizationId,
  ) => Effect.Effect<Credential | undefined, DatabaseError>;
}

export class CredentialsRepository extends Context.Service<
  CredentialsRepository,
  CredentialsRepositoryService
>()("@namera-ai/database/CredentialsRepository") {
  static readonly layer: Layer.Layer<CredentialsRepository, never, Database> = Layer.effect(
    CredentialsRepository,
    Effect.gen(function* () {
      const database = yield* Database;
      return CredentialsRepository.of({
        insert: Effect.fn("database.credentialsRepository.insert")(
          function* (input) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .insert(credentials)
              .values({
                ...Schema.encodeSync(CredentialInsert)(input),
                id: input.id,
                organizationId: input.organizationId,
              })
              .returning();
            return Schema.decodeUnknownSync(Credential)(rows[0]);
          },
          mapRepositoryError,
          Effect.mapError(
            () =>
              new DatabaseError({
                // Driver failures can retain bound ciphertext in their query parameters.
                cause: new Error("Credential insert failed"),
                message: "Credential insert failed",
              }),
          ),
        ),
        findById: Effect.fn("database.credentialsRepository.findById")(function* (
          id,
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.credentials.findFirst({
            where: { id: { eq: id }, organizationId: { eq: organizationId } },
          });
          return row === undefined ? undefined : Schema.decodeUnknownSync(Credential)(row);
        }, mapRepositoryError),
      });
    }),
  );
}
