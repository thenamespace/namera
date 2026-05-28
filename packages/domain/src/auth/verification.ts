import { Effect, Layer, Context, Schema } from "effect";

import { eq } from "drizzle-orm";

import {
  type Database,
  TransactionOrDatabase,
  verification,
} from "@namera-ai/database";
import {
  VerificationId,
  DatabaseError,
  mapToDatabaseError,
} from "@namera-ai/schema";
import {
  Verification,
  VerificationInsert,
  VerificationUpdate,
} from "@namera-ai/schema/database";

export type VerificationRepo = {
  createVerification: (
    params: VerificationInsert,
  ) => Effect.Effect<Verification, DatabaseError, Database.Database>;
  findVerification: (params: {
    identifier: string;
  }) => Effect.Effect<
    Verification | undefined,
    DatabaseError,
    Database.Database
  >;
  deleteVerification: (params: {
    identifier: string;
  }) => Effect.Effect<void, DatabaseError, Database.Database>;
  updateVerification: (
    verificationId: VerificationId,
    params: VerificationUpdate,
  ) => Effect.Effect<Verification, DatabaseError, Database.Database>;
};

export const VerificationRepo =
  Context.Service<VerificationRepo>("VerificationRepo");

export const layer = Layer.succeed(
  VerificationRepo,
  VerificationRepo.of({
    createVerification: Effect.fn("createVerification")(function* (params) {
      const db = yield* TransactionOrDatabase;
      const encoded = Schema.encodeSync(VerificationInsert)(params);
      const res = yield* db
        .insert(verification)
        .values(encoded as any)
        .returning();

      return Schema.decodeUnknownSync(Verification)(res[0]);
    }, mapToDatabaseError),
    deleteVerification: Effect.fn("deleteVerification")(function* (params) {
      const db = yield* TransactionOrDatabase;

      yield* db
        .delete(verification)
        .where(eq(verification.identifier, params.identifier));
    }, mapToDatabaseError),
    findVerification: Effect.fn("findVerification")(function* (params) {
      const db = yield* TransactionOrDatabase;

      const res = yield* db.query.verification.findFirst({
        where: {
          identifier: {
            eq: params.identifier,
          },
        },
      });

      return Schema.decodeUnknownSync(Verification)(res);
    }, mapToDatabaseError),
    updateVerification: Effect.fn("updateVerification")(function* (
      verificationId,
      params,
    ) {
      const db = yield* TransactionOrDatabase;
      const encoded = Schema.encodeSync(VerificationUpdate)(params);
      const res = yield* db
        .update(verification)
        .set(encoded as any)
        .where(eq(verification.id, verificationId))
        .returning();

      return Schema.decodeUnknownSync(Verification)(res[0]);
    }, mapToDatabaseError),
  }),
);
