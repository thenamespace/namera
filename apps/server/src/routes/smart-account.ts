import type {
  CreateSmartAccountRequest,
  GetSmartAccountRequest,
} from "@namera-ai/schema";

import { Effect } from "effect";

import { HttpApiBuilder } from "effect/unstable/httpapi";

import { api, AuthenticatedUser, Unauthorized } from "@namera-ai/api";
import { Database, Transaction } from "@namera-ai/database";
import { CoreRepo } from "@namera-ai/domain";

const getSmartAccount = (params: GetSmartAccountRequest) =>
  Effect.gen(function* () {
    const user = (yield* AuthenticatedUser).user;
    const db = yield* Database.Database;
    const coreRepo = yield* CoreRepo.CoreRepo;

    const sa = yield* db
      .transaction((tx) =>
        Effect.gen(function* () {
          yield* Transaction.setCurrentUser(user.id);
          return yield* coreRepo.smartAccount.findSmartAccount(params);
        }).pipe(Transaction.withTx(tx)),
      )
      .pipe(Effect.orDie);

    return sa;
  });

const listSmartAccountsHandler = () =>
  Effect.gen(function* () {
    const { session, user } = yield* AuthenticatedUser;
    const db = yield* Database.Database;
    const coreRepo = yield* CoreRepo.CoreRepo;

    if (!session.activeOrganizationId) {
      return [];
    }
    const organizationId = session.activeOrganizationId;

    const res = yield* db
      .transaction((tx) =>
        Effect.gen(function* () {
          console.log("list smart account");
          console.log(user.id);
          console.log("setting current user");
          yield* Transaction.setCurrentUser(user.id);
          console.log("current user set");
          console.log("getting smart account");
          return yield* coreRepo.smartAccount.listSmartAccounts(organizationId);
        }).pipe(Transaction.withTx(tx)),
      )
      .pipe(Effect.orDie);

    return res;
  });

const createSmartAccountHandler = (params: CreateSmartAccountRequest) =>
  Effect.gen(function* () {
    const { session, user } = yield* AuthenticatedUser;
    const db = yield* Database.Database;
    const coreRepo = yield* CoreRepo.CoreRepo;

    if (!session.activeOrganizationId) {
      return yield* Effect.fail(new Unauthorized());
    }
    const organizationId = session.activeOrganizationId;

    const res = yield* db
      .transaction((tx) =>
        Effect.gen(function* () {
          console.log("creating smart account");
          console.log(user.id);
          console.log("setting current user");
          yield* Transaction.setCurrentUser(user.id);
          console.log("current user set");
          console.log("creating smart account");
          return yield* coreRepo.smartAccount.createSmartAccount(
            user.id,
            organizationId,
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
