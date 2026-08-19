// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type {
  ActorId,
  DatabaseError,
  OrganizationId,
  SignatureOperationId,
} from "@namera-ai/protocol";
import {
  SignatureOperation,
  SignatureOperationInsert,
  type SignatureOperation as SignatureOperationModel,
  type SignatureOperationFailureCode,
  type SignatureOperationInsert as SignatureOperationInsertModel,
} from "@namera-ai/protocol/model";
import { and, eq } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { signatureOperation } from "#/schema/index";

export interface SignatureOperationRepositoryService {
  readonly insert: (
    data: SignatureOperationInsertModel,
  ) => Effect.Effect<
    { readonly operation: SignatureOperationModel; readonly inserted: boolean },
    DatabaseError
  >;
  readonly findByActorAndIdempotencyKey: (
    organizationId: OrganizationId,
    actorId: ActorId,
    idempotencyKey: string,
  ) => Effect.Effect<SignatureOperationModel | undefined, DatabaseError>;
  readonly findByIdForUpdate: (
    id: SignatureOperationId,
    organizationId: OrganizationId,
  ) => Effect.Effect<SignatureOperationModel | undefined, DatabaseError>;
  readonly markSucceeded: (input: {
    readonly id: SignatureOperationId;
    readonly organizationId: OrganizationId;
    readonly succeededAt: DateTime.Utc;
  }) => Effect.Effect<SignatureOperationModel | undefined, DatabaseError>;
  readonly markFailed: (input: {
    readonly id: SignatureOperationId;
    readonly organizationId: OrganizationId;
    readonly failureCode: SignatureOperationFailureCode;
    readonly failedAt: DateTime.Utc;
  }) => Effect.Effect<SignatureOperationModel | undefined, DatabaseError>;
}

const encodeDate = Schema.encodeSync(Schema.DateTimeUtcFromDate);

export class SignatureOperationRepository extends Context.Service<
  SignatureOperationRepository,
  SignatureOperationRepositoryService
>()("@namera-ai/database/SignatureOperationRepository") {
  static readonly layer: Layer.Layer<SignatureOperationRepository, never, Database> = Layer.effect(
    SignatureOperationRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return SignatureOperationRepository.of({
        insert: Effect.fn("database.signatureOperationRepository.insert")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(SignatureOperationInsert)(data);
          const rows = yield* db
            .insert(signatureOperation)
            .values(encoded as any)
            .onConflictDoNothing({
              target: [
                signatureOperation.organizationId,
                signatureOperation.actorId,
                signatureOperation.idempotencyKey,
              ],
            })
            .returning();
          if (rows[0]) {
            return {
              operation: Schema.decodeSync(SignatureOperation)(rows[0] as any),
              inserted: true,
            };
          }

          const existing = yield* db.query.signatureOperation.findFirst({
            where: {
              organizationId: { eq: data.organizationId },
              actorId: { eq: data.actorId },
              idempotencyKey: { eq: data.idempotencyKey },
            },
          });
          return {
            operation: Schema.decodeSync(SignatureOperation)(existing! as any),
            inserted: false,
          };
        }, mapRepositoryError),
        findByActorAndIdempotencyKey: Effect.fn(
          "database.signatureOperationRepository.findByActorAndIdempotencyKey",
        )(function* (organizationId, actorId, idempotencyKey) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.signatureOperation.findFirst({
            where: {
              organizationId: { eq: organizationId },
              actorId: { eq: actorId },
              idempotencyKey: { eq: idempotencyKey },
            },
          });
          return row === undefined ? undefined : Schema.decodeSync(SignatureOperation)(row as any);
        }, mapRepositoryError),
        findByIdForUpdate: Effect.fn("database.signatureOperationRepository.findByIdForUpdate")(
          function* (id, organizationId) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(signatureOperation)
              .where(
                and(
                  eq(signatureOperation.id, id),
                  eq(signatureOperation.organizationId, organizationId),
                ),
              )
              .limit(1)
              .for("update");
            return rows[0] ? Schema.decodeSync(SignatureOperation)(rows[0] as any) : undefined;
          },
          mapRepositoryError,
        ),
        markSucceeded: Effect.fn("database.signatureOperationRepository.markSucceeded")(function* ({
          id,
          organizationId,
          succeededAt,
        }) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(signatureOperation)
            .set({ status: "succeeded", succeededAt: encodeDate(succeededAt) })
            .where(
              and(
                eq(signatureOperation.id, id),
                eq(signatureOperation.organizationId, organizationId),
                eq(signatureOperation.status, "reserved"),
              ),
            )
            .returning();
          return rows[0] ? Schema.decodeSync(SignatureOperation)(rows[0] as any) : undefined;
        }, mapRepositoryError),
        markFailed: Effect.fn("database.signatureOperationRepository.markFailed")(function* ({
          id,
          organizationId,
          failureCode,
          failedAt,
        }) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(signatureOperation)
            .set({ status: "failed", failureCode, failedAt: encodeDate(failedAt) })
            .where(
              and(
                eq(signatureOperation.id, id),
                eq(signatureOperation.organizationId, organizationId),
                eq(signatureOperation.status, "reserved"),
              ),
            )
            .returning();
          return rows[0] ? Schema.decodeSync(SignatureOperation)(rows[0] as any) : undefined;
        }, mapRepositoryError),
      });
    }),
  );
}
