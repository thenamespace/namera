import { Effect, Layer, Context } from "effect";

import * as UserPreferenceRepo from "./user-preference";

export type CoreRepo = {
  userPreference: UserPreferenceRepo.UserPreferenceRepo;
};

export const CoreRepo = Context.Service<CoreRepo>("CoreRepo");

export const layer = Layer.effect(
  CoreRepo,
  Effect.gen(function* () {
    const userPreference = yield* UserPreferenceRepo.UserPreferenceRepo;

    return CoreRepo.of({
      userPreference,
    });
  }),
).pipe(Layer.provide(Layer.mergeAll(UserPreferenceRepo.layer)));
