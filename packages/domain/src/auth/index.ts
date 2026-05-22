import { Effect, Layer, Context } from "effect";

import * as MemberRepo from "./member";
import * as OrganizationRepo from "./organization";
import * as RoleRepo from "./role";
import * as SessionRepo from "./session";
import * as UserRepo from "./user";
import * as VerificationRepo from "./verification";

export type AuthRepo = {
  verification: VerificationRepo.VerificationRepo;
  user: UserRepo.UserRepo;
  session: SessionRepo.SessionRepo;
  organization: OrganizationRepo.OrganizationRepo;
  role: RoleRepo.RoleRepo;
  member: MemberRepo.MemberRepo;
};

export const AuthRepo = Context.Service<AuthRepo>("AuthRepo");

export const layer = Layer.effect(
  AuthRepo,
  Effect.gen(function* () {
    const verification = yield* VerificationRepo.VerificationRepo;
    const user = yield* UserRepo.UserRepo;
    const session = yield* SessionRepo.SessionRepo;
    const organization = yield* OrganizationRepo.OrganizationRepo;
    const member = yield* MemberRepo.MemberRepo;
    const role = yield* RoleRepo.RoleRepo;

    return AuthRepo.of({
      session,
      user,
      verification,
      organization,
      role,
      member,
    });
  }),
).pipe(
  Layer.provide(VerificationRepo.layer),
  Layer.provide(UserRepo.layer),
  Layer.provide(SessionRepo.layer),
  Layer.provide(OrganizationRepo.layer),
  Layer.provide(MemberRepo.layer),
  Layer.provide(RoleRepo.layer),
);
