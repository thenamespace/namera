import type { UpdateUserPreferencesRequest } from "@namera-ai/schema/dto";

import { Effect } from "effect";

import { HttpApiBuilder } from "effect/unstable/httpapi";

import { api, CurrentActor } from "@namera-ai/api";
import { Database, Transaction } from "@namera-ai/database";
import * as CoreRepo from "@namera-ai/domain/core";
import { mapToDatabaseError, mapToInternalError } from "@namera-ai/schema";

const getUserPreferences = Effect.gen(function* () {
  const currentUser = yield* CurrentActor;
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
}).pipe(mapToDatabaseError, mapToInternalError);

const updateUserPreferences = (payload: UpdateUserPreferencesRequest) =>
  Effect.gen(function* () {
    const currentUser = yield* CurrentActor;
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
  }).pipe(mapToDatabaseError, mapToInternalError);

export const UserPreferencesGroupLive = HttpApiBuilder.group(
  api,
  "userPreferences",
  (handlers) =>
    handlers
      .handle("get", () => getUserPreferences)
      .handle("update", ({ payload }) => updateUserPreferences(payload)),
);
