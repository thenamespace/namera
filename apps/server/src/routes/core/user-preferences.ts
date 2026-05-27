import { Effect } from "effect";

import { HttpApiBuilder } from "effect/unstable/httpapi";

import { AuthenticatedUser, api } from "@namera-ai/api";
import { Database, Transaction } from "@namera-ai/database";
import * as CoreRepo from "@namera-ai/domain/core";
import {
  mapDatabaseError,
  UpdateUserPreferenceRequest,
} from "@namera-ai/schema";

const getUserPreferences = Effect.gen(function* () {
  const currentUser = yield* AuthenticatedUser;
  const coreRepo = yield* CoreRepo.CoreRepo;
  const db = yield* Database.Database;

  return yield* db.transaction((tx) =>
    Effect.gen(function* () {
      yield* Transaction.setActorContext({
        actorType: "user",
        userId: currentUser.user.id,
      });
      return yield* coreRepo.userPreference.get(currentUser.user.id);
    }).pipe(Transaction.withTx(tx)),
  );
}).pipe(mapDatabaseError);

const updateUserPreferences = (payload: UpdateUserPreferenceRequest) =>
  Effect.gen(function* () {
    const currentUser = yield* AuthenticatedUser;
    const coreRepo = yield* CoreRepo.CoreRepo;
    const db = yield* Database.Database;

    return yield* db.transaction((tx) =>
      Effect.gen(function* () {
        yield* Transaction.setActorContext({
          actorType: "user",
          userId: currentUser.user.id,
        });
        return yield* coreRepo.userPreference.update(
          currentUser.user.id,
          payload,
        );
      }).pipe(Transaction.withTx(tx)),
    );
  }).pipe(mapDatabaseError);

export const UserPreferencesGroupLive = HttpApiBuilder.group(
  api,
  "userPreferences",
  (handlers) =>
    handlers
      .handle("get", () => getUserPreferences)
      .handle("update", ({ payload }) => updateUserPreferences(payload)),
);
