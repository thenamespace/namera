// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError, Email, VerificationId } from "@namera-ai/protocol";
import {
  Verification,
  VerificationInsert,
  type VerificationPurpose,
} from "@namera-ai/protocol/model";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { verification } from "#/schema/index";

export interface VerificationRepositoryService {
  create: (data: VerificationInsert) => Effect.Effect<Verification | undefined, DatabaseError>;
  findById: (
    verificationId: VerificationId,
  ) => Effect.Effect<Verification | undefined, DatabaseError>;
  findPendingByIdentifier: (params: {
    purpose: VerificationPurpose;
    identifier: Email;
    now: DateTime.Utc;
    maxAttempts: number;
  }) => Effect.Effect<Verification | undefined, DatabaseError>;
  revokePending: (params: {
    purpose: VerificationPurpose;
    identifier: Email;
    revokedAt: DateTime.Utc;
  }) => Effect.Effect<ReadonlyArray<Verification>, DatabaseError>;
  incrementAttempts: (params: {
    verificationId: VerificationId;
    now: DateTime.Utc;
    maxAttempts: number;
  }) => Effect.Effect<Verification | undefined, DatabaseError>;
  consume: (params: {
    verificationId: VerificationId;
    consumedAt: DateTime.Utc;
    maxAttempts: number;
  }) => Effect.Effect<Verification | undefined, DatabaseError>;
}

export class VerificationRepository extends Context.Service<
  VerificationRepository,
  VerificationRepositoryService
>()("@namera-ai/database/VerificationRepository") {
  static readonly layer: Layer.Layer<VerificationRepository, never, Database> = Layer.effect(
    VerificationRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return VerificationRepository.of({
        create: Effect.fn("database.verificationRepository.create")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(VerificationInsert)(data);
          const rows = yield* db
            .insert(verification)
            .values(parsed as any)
            .onConflictDoNothing()
            .returning();

          return rows[0] ? Schema.decodeSync(Verification)(rows[0]) : undefined;
        }, mapRepositoryError),
        findById: Effect.fn("database.verificationRepository.findById")(function* (verificationId) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.verification.findFirst({
            where: {
              id: { eq: verificationId },
            },
          });

          return row ? Schema.decodeSync(Verification)(row) : undefined;
        }, mapRepositoryError),
        findPendingByIdentifier: Effect.fn(
          "database.verificationRepository.findPendingByIdentifier",
        )(function* ({ purpose, identifier, now, maxAttempts }) {
          const db = yield* transactionOrDatabase(database);
          const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
          const rows = yield* db
            .select()
            .from(verification)
            .where(
              and(
                eq(verification.purpose, purpose),
                eq(verification.identifier, identifier),
                isNull(verification.consumedAt),
                isNull(verification.revokedAt),
                gt(verification.expiresAt, encodedNow),
                lt(verification.attempts, maxAttempts),
              ),
            )
            .orderBy(desc(verification.createdAt))
            .limit(1);

          return rows[0] ? Schema.decodeSync(Verification)(rows[0]) : undefined;
        }, mapRepositoryError),
        revokePending: Effect.fn("database.verificationRepository.revokePending")(function* ({
          purpose,
          identifier,
          revokedAt,
        }) {
          const db = yield* transactionOrDatabase(database);
          const encodedRevokedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(revokedAt);
          const rows = yield* db
            .update(verification)
            .set({ revokedAt: encodedRevokedAt })
            .where(
              and(
                eq(verification.purpose, purpose),
                eq(verification.identifier, identifier),
                isNull(verification.consumedAt),
                isNull(verification.revokedAt),
              ),
            )
            .returning();

          return Schema.decodeSync(Schema.Array(Verification))(rows);
        }, mapRepositoryError),
        incrementAttempts: Effect.fn("database.verificationRepository.incrementAttempts")(
          function* ({ verificationId, now, maxAttempts }) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
            const rows = yield* db
              .update(verification)
              .set({ attempts: sql`${verification.attempts} + 1` })
              .where(
                and(
                  eq(verification.id, verificationId),
                  isNull(verification.consumedAt),
                  isNull(verification.revokedAt),
                  gt(verification.expiresAt, encodedNow),
                  lt(verification.attempts, maxAttempts),
                ),
              )
              .returning();

            return rows[0] ? Schema.decodeSync(Verification)(rows[0]) : undefined;
          },
          mapRepositoryError,
        ),
        consume: Effect.fn("database.verificationRepository.consume")(function* ({
          verificationId,
          consumedAt,
          maxAttempts,
        }) {
          const db = yield* transactionOrDatabase(database);
          const encodedConsumedAt = Schema.encodeSync(Schema.DateTimeUtcFromDate)(consumedAt);
          const rows = yield* db
            .update(verification)
            .set({ consumedAt: encodedConsumedAt })
            .where(
              and(
                eq(verification.id, verificationId),
                isNull(verification.consumedAt),
                isNull(verification.revokedAt),
                gt(verification.expiresAt, encodedConsumedAt),
                lt(verification.attempts, maxAttempts),
              ),
            )
            .returning();

          return rows[0] ? Schema.decodeSync(Verification)(rows[0]) : undefined;
        }, mapRepositoryError),
      });
    }),
  );
}
