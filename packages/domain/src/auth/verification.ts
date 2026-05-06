import type {
  Verification,
  VerificationInsert,
  VerificationUpdate,
} from "@namera-ai/schema";

import { Effect, Layer, Context } from "effect";

import { eq } from "drizzle-orm";

import {
  type Database,
  TransactionOrDatabase,
  verification,
} from "@namera-ai/database";

export type VerificationRepo = {
  createVerification: (
    params: VerificationInsert,
  ) => Effect.Effect<void, never, Database.Database>;
  findVerification: (params: {
    identifier: string;
  }) => Effect.Effect<Verification | undefined, never, Database.Database>;
  deleteVerification: (params: {
    identifier: string;
  }) => Effect.Effect<void, never, Database.Database>;
  updateVerification: (
    identifier: string,
    params: VerificationUpdate,
  ) => Effect.Effect<void, never, Database.Database>;
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
      }).pipe(Effect.orDie),
    deleteVerification: (params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;

        yield* db
          .delete(verification)
          .where(eq(verification.identifier, params.identifier));
      }).pipe(Effect.orDie),
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

        return res;
      }).pipe(Effect.orDie),

    updateVerification: (identifier, params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        yield* db
          .update(verification)
          .set(params)
          .where(eq(verification.id, identifier));
      }).pipe(Effect.orDie),
  }),
);
