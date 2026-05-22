import { Effect, Layer, Context, Schema } from "effect";

import { eq } from "drizzle-orm";

import {
  type Database,
  TransactionOrDatabase,
  verification,
} from "@namera-ai/database";
import {
  Verification,
  VerificationId,
  type VerificationInsert,
  type VerificationUpdate,
  mapDatabaseError,
  DatabaseError,
} from "@namera-ai/schema";

export type VerificationRepo = {
  createVerification: (
    params: VerificationInsert,
  ) => Effect.Effect<void, DatabaseError, Database.Database>;
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
  ) => Effect.Effect<void, DatabaseError, Database.Database>;
};

export const VerificationRepo =
  Context.Service<VerificationRepo>("VerificationRepo");

export const layer = Layer.succeed(
  VerificationRepo,
  VerificationRepo.of({
    createVerification: (params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        yield* db.insert(verification).values(params);
      }).pipe(mapDatabaseError),
    deleteVerification: (params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;

        yield* db
          .delete(verification)
          .where(eq(verification.identifier, params.identifier));
      }).pipe(mapDatabaseError),
    findVerification: (params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;

        const res = yield* db.query.verification.findFirst({
          where: {
            identifier: {
              eq: params.identifier,
            },
          },
        });

        return Schema.decodeUnknownSync(Verification)(res);
      }).pipe(mapDatabaseError),

    updateVerification: (verificationId, params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        yield* db
          .update(verification)
          .set(params)
          .where(eq(verification.id, verificationId));
      }).pipe(mapDatabaseError),
  }),
);
