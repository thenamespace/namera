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
import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { signatureOperation } from "#/schema/index";

export interface SignatureOperationRepositoryService {
  readonly claimForSigning: (input: {
    readonly id: SignatureOperationId;
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly leaseToken: string;
    readonly now: DateTime.Utc;
    readonly leaseExpiresAt: DateTime.Utc;
  }) => Effect.Effect<SignatureOperationModel | undefined, DatabaseError>;
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
    skipLocked?: boolean,
  ) => Effect.Effect<SignatureOperationModel | undefined, DatabaseError>;
  readonly findByIdForActor: (
    id: SignatureOperationId,
    organizationId: OrganizationId,
    actorId: ActorId,
  ) => Effect.Effect<SignatureOperationModel | undefined, DatabaseError>;
  readonly markSucceeded: (input: {
    readonly leaseToken?: string;
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
        claimForSigning: Effect.fn("database.signatureOperationRepository.claimForSigning")(
          function* (input) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .update(signatureOperation)
              .set({
                leaseToken: input.leaseToken,
                leaseExpiresAt: encodeDate(input.leaseExpiresAt),
              })
              .where(
                and(
                  eq(signatureOperation.id, input.id),
                  eq(signatureOperation.organizationId, input.organizationId),
                  eq(signatureOperation.actorId, input.actorId),
                  eq(signatureOperation.status, "reserved"),
                  gt(signatureOperation.reservationExpiresAt, encodeDate(input.now)),
                  or(
                    isNull(signatureOperation.leaseExpiresAt),
                    lte(signatureOperation.leaseExpiresAt, encodeDate(input.now)),
                  ),
                  sql`${signatureOperation.data}->>'managedSignerBinding' IS NOT NULL`,
                ),
              )
              .returning();
            return rows[0] === undefined
              ? undefined
              : Schema.decodeUnknownSync(SignatureOperation)(rows[0]);
          },
          mapRepositoryError,
        ),
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
          function* (id, organizationId, skipLocked = false) {
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
              .for("update", skipLocked ? { skipLocked: true } : {});
            return rows[0] ? Schema.decodeSync(SignatureOperation)(rows[0] as any) : undefined;
          },
          mapRepositoryError,
        ),
        findByIdForActor: Effect.fn("database.signatureOperationRepository.findByIdForActor")(
          function* (id, organizationId, actorId) {
            const db = yield* transactionOrDatabase(database);
            const row = yield* db.query.signatureOperation.findFirst({
              where: {
                id: { eq: id },
                organizationId: { eq: organizationId },
                actorId: { eq: actorId },
              },
            });
            return row === undefined
              ? undefined
              : Schema.decodeUnknownSync(SignatureOperation)(row);
          },
          mapRepositoryError,
        ),
        markSucceeded: Effect.fn("database.signatureOperationRepository.markSucceeded")(function* ({
          id,
          organizationId,
          succeededAt,
          leaseToken,
        }) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(signatureOperation)
            .set({
              status: "succeeded",
              succeededAt: encodeDate(succeededAt),
              leaseToken: null,
              leaseExpiresAt: null,
            })
            .where(
              and(
                eq(signatureOperation.id, id),
                eq(signatureOperation.organizationId, organizationId),
                eq(signatureOperation.status, "reserved"),
                gt(signatureOperation.reservationExpiresAt, encodeDate(succeededAt)),
                leaseToken === undefined
                  ? sql`${signatureOperation.data}->>'managedSignerBinding' IS NULL`
                  : and(
                      eq(signatureOperation.leaseToken, leaseToken),
                      gt(signatureOperation.leaseExpiresAt, encodeDate(succeededAt)),
                    ),
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
            .set({
              status: "failed",
              failureCode,
              failedAt: encodeDate(failedAt),
              leaseToken: null,
              leaseExpiresAt: null,
            })
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
