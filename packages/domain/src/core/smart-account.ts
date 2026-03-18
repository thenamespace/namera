import {
  type Database,
  smartAccount,
  TransactionOrDatabase,
} from "@namera-ai/database";
import type {
  SmartAccount,
  SmartAccountInsert,
  UserId,
} from "@namera-ai/schema";
import { Context, Effect, Layer } from "effect";

type SmartAccountRepoShape = {
  createSmartAccount: (
    params: SmartAccountInsert,
  ) => Effect.Effect<SmartAccount, never, Database>;
  listSmartAccounts: (
    userId: UserId,
  ) => Effect.Effect<SmartAccount[], never, Database>;
};

export class SmartAccountRepo extends Context.Tag(
  "@namera/domain/SmartAccount",
)<SmartAccountRepo, SmartAccountRepoShape>() {}

export const SmartAccountRepoLive = Layer.effect(
  SmartAccountRepo,
  Effect.gen(function* () {
    return SmartAccountRepo.of({
      createSmartAccount: (params) =>
        Effect.gen(function* () {
          const db = yield* TransactionOrDatabase;
          const res = yield* db
            .insert(smartAccount)
            .values(params)
            .returning()
            .pipe(Effect.orDie);

          // biome-ignore lint/style/noNonNullAssertion: safe
          return res[0]!;
        }),
      listSmartAccounts: (userId) =>
        Effect.gen(function* () {
          const db = yield* TransactionOrDatabase;
          const res = yield* db.query.smartAccount
            .findMany({
              where: {
                userId: { eq: userId },
              },
            })
            .pipe(Effect.orDie);

          return res;
        }),
    });
  }),
);
