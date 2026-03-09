import { Context, Effect, Layer } from "effect";

import { SessionRepo, SessionRepoLive, type SessionRepoShape } from "./session";
import { UserRepo, UserRepoLive, type UserRepoShape } from "./user";
import {
  VerificationRepo,
  VerificationRepoLive,
  type VerificationRepoShape,
} from "./verification";

export type AuthRepoShape = {
  verification: VerificationRepoShape;
  user: UserRepoShape;
  session: SessionRepoShape;
};

export class AuthRepo extends Context.Tag("AuthRepo")<
  AuthRepo,
  AuthRepoShape
>() {}

export const AuthRepoLive = Layer.effect(
  AuthRepo,
  Effect.gen(function* () {
    const verification = yield* VerificationRepo;
    const user = yield* UserRepo;
    const session = yield* SessionRepo;

    return AuthRepo.of({
      session,
      user,
      verification,
    });
  }),
).pipe(
  Layer.provide(VerificationRepoLive),
  Layer.provide(UserRepoLive),
  Layer.provide(SessionRepoLive),
);
