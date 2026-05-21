import { Effect, Layer, Context } from "effect";

import * as SmartAccountRepo from "./smart-account";
import * as UserPreferenceRepo from "./user-preference";

export type CoreRepo = {
  smartAccount: SmartAccountRepo.SmartAccountRepo;
  userPreference: UserPreferenceRepo.UserPreferenceRepo;
};

export const CoreRepo = Context.Service<CoreRepo>("CoreRepo");

export const layer = Layer.effect(
  CoreRepo,
  Effect.gen(function* () {
    const smartAccount = yield* SmartAccountRepo.SmartAccountRepo;
    const userPreference = yield* UserPreferenceRepo.UserPreferenceRepo;

    return CoreRepo.of({
      smartAccount,
      userPreference,
    });
  }),
).pipe(
  Layer.provide(
    Layer.mergeAll(SmartAccountRepo.layer, UserPreferenceRepo.layer),
  ),
);
