import { HttpApiBuilder } from "@effect/platform";
import { AuthenticatedUser, api } from "@namera-ai/api";
import { Database, setCurrentUser, withTx } from "@namera-ai/database";
import { SmartAccountRepo } from "@namera-ai/domain/smart-account";
import type { CreateSmartAccountPayload } from "@namera-ai/schema";
import { Effect } from "effect";

const createSmartAccountHandler = (payload: CreateSmartAccountPayload) =>
  Effect.succeed("ok" as any);

const listSmartAccountsHandler = () =>
  Effect.gen(function* () {
    const currentUser = yield* AuthenticatedUser;

    const db = yield* Database;
    const smartAccountRepo = yield* SmartAccountRepo;

    const res = yield* db
      .transaction((tx) =>
        Effect.gen(function* () {
          yield* setCurrentUser(currentUser.user.id);
          const res = yield* smartAccountRepo.listSmartAccounts(
            currentUser.user.id,
          );
          return res;
        }).pipe(withTx(tx)),
      )
      .pipe(Effect.orDie);

    return { accounts: res };
  });

export const SmartAccountGroupLive = HttpApiBuilder.group(
  api,
  "smartAccount",
  (handlers) =>
    handlers
      .handle("list", listSmartAccountsHandler)
      .handle("create", ({ payload }) => createSmartAccountHandler(payload)),
);
