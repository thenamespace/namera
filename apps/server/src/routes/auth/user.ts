import { Effect } from "effect";

import { HttpApiBuilder } from "effect/unstable/httpapi";

import { AuthenticatedUser, api } from "@namera-ai/api";
import { Transaction, Database } from "@namera-ai/database";
import * as AuthRepo from "@namera-ai/domain/auth";
import { mapDatabaseError, UpdateUserRequest } from "@namera-ai/schema";

const updateUserHandler = (payload: UpdateUserRequest) =>
  Effect.gen(function* () {
    const currentUser = yield* AuthenticatedUser;
    const authRepo = yield* AuthRepo.AuthRepo;
    const db = yield* Database.Database;

    return yield* db.transaction((tx) =>
      Effect.gen(function* () {
        yield* Transaction.setActorContext({
          actorType: "user",
          userId: currentUser.user.id,
        });
        return yield* authRepo.user.updateUser(currentUser.user.id, {
          name: payload.name,
        });
      }).pipe(Transaction.withTx(tx)),
    );
  }).pipe(mapDatabaseError);

export const UserGroupLive = HttpApiBuilder.group(api, "user", (handlers) =>
  handlers.handle("update", ({ payload }) => updateUserHandler(payload)),
);
