import { Context, Effect, Layer } from "effect";

import type { Database } from "#/core/index";
import {
  OrganizationInvitationRepository,
  OrganizationMemberRepository,
  OrganizationRepository,
  OrganizationRoleRepository,
  SessionRepository,
  UserRepository,
  VerificationRepository,
} from "#/repositories/auth/index";

export type Repository = {
  auth: {
    invitation: OrganizationInvitationRepository.OrganizationInvitationRepository;
    member: OrganizationMemberRepository.OrganizationMemberRepository;
    organization: OrganizationRepository.OrganizationRepository;
    role: OrganizationRoleRepository.OrganizationRoleRepository;
    session: SessionRepository.SessionRepository;
    user: UserRepository.UserRepository;
    verification: VerificationRepository.VerificationRepository;
  };
};

export const Repository = Context.Service<Repository>("Repository");

export const layer: Layer.Layer<Repository, never, Database.Database> = Layer.effect(
  Repository,
  Effect.gen(function* () {
    const invitation = yield* OrganizationInvitationRepository.OrganizationInvitationRepository;
    const member = yield* OrganizationMemberRepository.OrganizationMemberRepository;
    const organization = yield* OrganizationRepository.OrganizationRepository;
    const role = yield* OrganizationRoleRepository.OrganizationRoleRepository;
    const session = yield* SessionRepository.SessionRepository;
    const user = yield* UserRepository.UserRepository;
    const verification = yield* VerificationRepository.VerificationRepository;

    return Repository.of({
      auth: {
        invitation,
        organization,
        member,
        role,
        session,
        user,
        verification,
      },
    });
  }),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      OrganizationInvitationRepository.layer,
      OrganizationMemberRepository.layer,
      OrganizationRepository.layer,
      OrganizationRoleRepository.layer,
      SessionRepository.layer,
      UserRepository.layer,
      VerificationRepository.layer,
    ),
  ),
);
