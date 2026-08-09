import { Context, Effect, Layer } from "effect";

import type { Database } from "#/core/index";
import {
  ActorRepository,
  OrganizationInvitationRepository,
  OrganizationMemberRepository,
  OrganizationRepository,
  OrganizationRoleRepository,
  SessionRepository,
  UserRepository,
  VerificationRepository,
} from "#/repositories/auth/index";

export interface RepositoryService {
  auth: {
    actor: ActorRepository["Service"];
    invitation: OrganizationInvitationRepository["Service"];
    member: OrganizationMemberRepository["Service"];
    organization: OrganizationRepository["Service"];
    role: OrganizationRoleRepository["Service"];
    session: SessionRepository["Service"];
    user: UserRepository["Service"];
    verification: VerificationRepository["Service"];
  };
}

export class Repository extends Context.Service<Repository, RepositoryService>()(
  "@namera-ai/database/Repository",
) {
  static readonly layer: Layer.Layer<Repository, never, Database> = Layer.effect(
    Repository,
    Effect.gen(function* () {
      const actor = yield* ActorRepository;
      const invitation = yield* OrganizationInvitationRepository;
      const member = yield* OrganizationMemberRepository;
      const organization = yield* OrganizationRepository;
      const role = yield* OrganizationRoleRepository;
      const session = yield* SessionRepository;
      const user = yield* UserRepository;
      const verification = yield* VerificationRepository;

      return Repository.of({
        auth: {
          actor,
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
        ActorRepository.layer,
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
}
