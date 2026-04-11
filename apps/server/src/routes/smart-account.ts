import type {
  CreateSmartAccountRequest,
  GetSmartAccountRequest,
} from "@namera-ai/schema";

import { Effect } from "effect";

import { HttpApiBuilder } from "effect/unstable/httpapi";

import { api, AuthenticatedUser } from "@namera-ai/api";
import { Database, Transaction } from "@namera-ai/database";
import { CoreRepo } from "@namera-ai/domain";

const getSmartAccount = (params: GetSmartAccountRequest) =>
  Effect.gen(function* () {
    yield* AuthenticatedUser;
    const db = yield* Database.Database;
    const coreRepo = yield* CoreRepo.CoreRepo;

    const sa = yield* db
      .transaction((tx) =>
        coreRepo.smartAccount
          .findSmartAccount(params)
          .pipe(Transaction.withTx(tx)),
      )
      .pipe(Effect.orDie);

    return sa;
  });

const listSmartAccountsHandler = () =>
  Effect.gen(function* () {
    const user = (yield* AuthenticatedUser).user;
    const db = yield* Database.Database;
    const coreRepo = yield* CoreRepo.CoreRepo;

    const res = yield* db
      .transaction((tx) =>
        Effect.gen(function* () {
          return yield* coreRepo.smartAccount.listSmartAccounts(user.id);
        }).pipe(Transaction.withTx(tx)),
      )
      .pipe(Effect.orDie);

    return res;
  });

const createSmartAccountHandler = (params: CreateSmartAccountRequest) =>
  Effect.gen(function* () {
    const user = (yield* AuthenticatedUser).user;
    const db = yield* Database.Database;
    const coreRepo = yield* CoreRepo.CoreRepo;

    const res = yield* db
      .transaction((tx) =>
        Effect.gen(function* () {
          return yield* coreRepo.smartAccount.createSmartAccount(
            user.id,
            params,
          );
        }).pipe(Transaction.withTx(tx)),
      )
      .pipe(Effect.orDie);

    return res;
  });
export const SmartAccountGroupLive = HttpApiBuilder.group(
  api,
  "smartAccount",
  (handlers) =>
    handlers
      .handle("getSmartAccount", ({ params }) => getSmartAccount(params))
      .handle("listSmartAccounts", () => listSmartAccountsHandler())
      .handle("createSmartAccount", ({ payload }) =>
        createSmartAccountHandler(payload),
      ),
);
