import { Context, Effect, Layer } from "effect";

import type { Database } from "#/core/index";
import { OrganizationEventRepository, UserEventRepository } from "#/repositories/audit/index";
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
import {
  BillingAccountRepository,
  BillingSubscriptionRepository,
  BillingUsageRepository,
} from "#/repositories/billing/index";
import { EmailJobRepository } from "#/repositories/jobs/index";
import {
  NotificationPreferenceRepository,
  NotificationRepository,
} from "#/repositories/notification/index";

export interface RepositoryService {
  audit: {
    organization: OrganizationEventRepository["Service"];
    user: UserEventRepository["Service"];
  };
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
  billing: {
    account: BillingAccountRepository["Service"];
    subscription: BillingSubscriptionRepository["Service"];
    usage: BillingUsageRepository["Service"];
  };
  jobs: {
    email: EmailJobRepository["Service"];
  };
  notification: {
    inbox: NotificationRepository["Service"];
    preference: NotificationPreferenceRepository["Service"];
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
      const organizationEvent = yield* OrganizationEventRepository;
      const userEvent = yield* UserEventRepository;
      const emailJob = yield* EmailJobRepository;
      const notification = yield* NotificationRepository;
      const notificationPreference = yield* NotificationPreferenceRepository;
      const billingAccount = yield* BillingAccountRepository;
      const billingSubscription = yield* BillingSubscriptionRepository;
      const billingUsage = yield* BillingUsageRepository;

      return Repository.of({
        audit: {
          organization: organizationEvent,
          user: userEvent,
        },
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
        billing: {
          account: billingAccount,
          subscription: billingSubscription,
          usage: billingUsage,
        },
        jobs: {
          email: emailJob,
        },
        notification: {
          inbox: notification,
          preference: notificationPreference,
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
        OrganizationEventRepository.layer,
        UserEventRepository.layer,
        EmailJobRepository.layer,
        NotificationRepository.layer,
        NotificationPreferenceRepository.layer,
        BillingAccountRepository.layer,
        BillingSubscriptionRepository.layer,
        BillingUsageRepository.layer,
      ),
    ),
  );
}
