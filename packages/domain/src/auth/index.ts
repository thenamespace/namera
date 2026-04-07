import { Effect, Layer, ServiceMap } from "effect";

import * as SessionRepo from "./session";
import * as UserRepo from "./user";
import * as VerificationRepo from "./verification";

export type AuthRepo = {
  verification: VerificationRepo.VerificationRepo;
  user: UserRepo.UserRepo;
  session: SessionRepo.SessionRepo;
};

export const AuthRepo = ServiceMap.Service<AuthRepo>("AuthRepo");

export const layer = Layer.effect(
  AuthRepo,
  Effect.gen(function* () {
    const verification = yield* VerificationRepo.VerificationRepo;
    const user = yield* UserRepo.UserRepo;
    const session = yield* SessionRepo.SessionRepo;

    return AuthRepo.of({
      session,
      user,
      verification,
    });
  }),
).pipe(
  Layer.provide(VerificationRepo.layer),
  Layer.provide(UserRepo.layer),
  Layer.provide(SessionRepo.layer),
);
