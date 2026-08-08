// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError, Email } from "@namera-ai/protocol";
import { type VerificationId } from "@namera-ai/protocol";
import {
  Verification,
  VerificationInsert,
  type VerificationPurpose,
  VerificationUpdate,
} from "@namera-ai/protocol/model";
import { and, eq } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { verification } from "#/schema/index";

export interface VerificationRepositoryService {
  insert: (params: VerificationInsert) => Effect.Effect<Verification, DatabaseError>;
  findByIdentifier: (params: {
    purpose: VerificationPurpose;
    identifier: Email;
  }) => Effect.Effect<Verification | undefined, DatabaseError>;
  update: (
    verificationId: VerificationId,
    params: VerificationUpdate,
  ) => Effect.Effect<Verification, DatabaseError>;
  delete: (params: {
    purpose: VerificationPurpose;
    identifier: Email;
  }) => Effect.Effect<void, DatabaseError>;
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
        insert: Effect.fn("insertVerification")(function* (params) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(VerificationInsert)(params);
          const res = yield* db
            .insert(verification)
            .values(parsed as any)
            .returning();

          return Schema.decodeSync(Verification)(res[0]!);
        }, mapToDatabaseError),
        findByIdentifier: Effect.fn("findVerificationByIdentifier")(function* (params) {
          const db = yield* transactionOrDatabase(database);

          const res = yield* db.query.verification.findFirst({
            where: {
              purpose: { eq: params.purpose },
              identifier: { eq: params.identifier },
            },
          });

          return res ? Schema.decodeSync(Verification)(res) : undefined;
        }, mapToDatabaseError),
        update: Effect.fn("updateVerification")(function* (verificationId, params) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(VerificationUpdate)(params);
          const res = yield* db
            .update(verification)
            .set(parsed as any)
            .where(eq(verification.id, verificationId))
            .returning();

          return Schema.decodeSync(Verification)(res[0]!);
        }, mapToDatabaseError),
        delete: Effect.fn("deleteVerification")(function* (params) {
          const db = yield* transactionOrDatabase(database);

          yield* db
            .delete(verification)
            .where(
              and(
                eq(verification.purpose, params.purpose),
                eq(verification.identifier, params.identifier),
              ),
            );
        }, mapToDatabaseError),
      });
    }),
  );
}
