// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError } from "@namera-ai/protocol";
import { type VerificationId } from "@namera-ai/protocol";
import { Verification, VerificationInsert, VerificationUpdate } from "@namera-ai/protocol/model";
import { eq } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { verification } from "#/schema/index";

export type VerificationRepository = {
  insert: (params: VerificationInsert) => Effect.Effect<Verification, DatabaseError>;
  findByIdentifier: (params: {
    identifier: string;
  }) => Effect.Effect<Verification | undefined, DatabaseError>;
  update: (
    verificationId: VerificationId,
    params: VerificationUpdate,
  ) => Effect.Effect<Verification, DatabaseError>;
  delete: (params: { identifier: string }) => Effect.Effect<void, DatabaseError>;
};

export const VerificationRepository =
  Context.Service<VerificationRepository>("VerificationRepository");

export const layer: Layer.Layer<VerificationRepository, never, Database.Database> = Layer.effect(
  VerificationRepository,
  Effect.gen(function* () {
    const database = yield* Database.Database;

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

        yield* db.delete(verification).where(eq(verification.identifier, params.identifier));
      }, mapToDatabaseError),
    });
  }),
);
