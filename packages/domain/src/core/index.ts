import { Effect, Layer, ServiceMap } from "effect";

import * as SmartAccountRepo from "./smart-account";

export type CoreRepo = {
  smartAccount: SmartAccountRepo.SmartAccountRepo;
};

export const CoreRepo = ServiceMap.Service<CoreRepo>("CoreRepo");

export const layer = Layer.effect(
  CoreRepo,
  Effect.gen(function* () {
    const smartAccount = yield* SmartAccountRepo.SmartAccountRepo;

    return CoreRepo.of({
      smartAccount,
    });
  }),
).pipe(Layer.provide(SmartAccountRepo.layer));
