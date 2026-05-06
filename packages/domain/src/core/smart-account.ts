import { Effect, Layer, Schema, Context } from "effect";

import { createPublicClient, http } from "viem";
import { toAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

import {
  Database,
  smartAccount,
  TransactionOrDatabase,
} from "@namera-ai/database";
import {
  CreateSmartAccountRequest,
  CreateSmartAccountResponse,
  GetSmartAccountRequest,
  GetSmartAccountResponse,
  ListSmartAccountsResponse,
  SmartAccount,
  UserId,
} from "@namera-ai/schema";
import { createAccountClient } from "@namera-ai/sdk/account";

export type SmartAccountRepo = {
  findSmartAccount: (
    data: GetSmartAccountRequest,
  ) => Effect.Effect<GetSmartAccountResponse, never, Database.Database>;
  listSmartAccounts: (
    userId: UserId,
  ) => Effect.Effect<ListSmartAccountsResponse, never, Database.Database>;
  createSmartAccount: (
    userId: UserId,
    params: CreateSmartAccountRequest,
  ) => Effect.Effect<CreateSmartAccountResponse, never, Database.Database>;
};

export const SmartAccountRepo =
  Context.Service<SmartAccountRepo>("SmartAccountRepo");

export const layer = Layer.succeed(
  SmartAccountRepo,
  SmartAccountRepo.of({
    findSmartAccount: (data) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const res = yield* db.query.smartAccount.findFirst({
          where:
            "address" in data
              ? { address: { eq: data.address } }
              : { id: { eq: data.id } },
        });
        const parsed = Schema.decodeUnknownSync(SmartAccount)(res);
        return parsed;
      }).pipe(Effect.orDie),
    listSmartAccounts: (userId) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const res = yield* db.query.smartAccount.findMany({
          where: {
            userId: { eq: userId },
          },
        });
        const parsed = res.map((r) =>
          Schema.decodeUnknownSync(SmartAccount)(r),
        );
        return parsed;
      }).pipe(Effect.orDie),
    createSmartAccount: (userId, params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;

        const account = toAccount({
          address: params.owner,
          signMessage: async () => {
            throw new Error("Not implemented");
          },
          signTransaction: async () => {
            throw new Error("Not implemented");
          },
          signTypedData: async () => {
            throw new Error("Not implemented");
          },
        });

        console.log("getting last account");
        const lastAccount = yield* db.query.smartAccount
          .findFirst({
            where: {
              owner: {
                eq: params.owner,
              },
            },
            orderBy: {
              index: "desc",
            },
          })
          .pipe(Effect.orDie);

        console.log("last account", lastAccount);

        const nextIndex = lastAccount ? lastAccount.index + 1 : 0;

        const publicClient = createPublicClient({
          chain: mainnet,
          transport: http(
            "https://eth-mainnet.g.alchemy.com/v2/e7dMA7qcIGZHxrSPkwn2W",
          ),
        });

        const sa = yield* Effect.promise(() =>
          createAccountClient({
            bundlerTransport: http(),
            chain: mainnet,
            entrypointVersion: "0.7",
            kernelVersion: "0.3.2",
            index: BigInt(nextIndex),
            type: "ecdsa",
            signer: account,
            client: publicClient,
          }),
        );

        console.log("creating smart account with address", sa.account.address);

        const res = yield* db
          .insert(smartAccount)
          .values({
            userId: userId,
            index: nextIndex,
            address: sa.account.address,
            ownerType: params.ownerType,
            owner: params.owner,
            entryPointVersion: "0.7",
            kernelVersion: "0.3.2",
            metadata: params.metadata,
          })
          .returning()
          .pipe(Effect.orDie);

        return Schema.decodeUnknownSync(SmartAccount)(res[0]);
      }),
  }),
);
