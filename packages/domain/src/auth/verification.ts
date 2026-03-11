import {
  type Database,
  TransactionOrDatabase,
  verification,
} from "@namera-ai/database";
import type {
  Verification,
  VerificationInsert,
  VerificationUpdate,
} from "@namera-ai/schema";
import { eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

export type VerificationRepoShape = {
  createVerification: (
    params: VerificationInsert,
  ) => Effect.Effect<void, never, Database>;
  findVerification: (params: {
    identifier: string;
  }) => Effect.Effect<Verification | undefined, never, Database>;
  deleteVerification: (params: {
    identifier: string;
  }) => Effect.Effect<void, never, Database>;
  updateVerification: (
    identifier: string,
    params: VerificationUpdate,
  ) => Effect.Effect<void, never, Database>;
};

export class VerificationRepo extends Context.Tag("VerificationRepo")<
  VerificationRepo,
  VerificationRepoShape
>() {}

export const VerificationRepoLive = Layer.succeed(
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
