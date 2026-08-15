import { Context, Effect, Layer } from "effect";

import type { Database } from "#/core/index";
import { OrganizationEventRepository, UserEventRepository } from "#/repositories/audit/index";
import {
  ActorRepository,
  ApiKeyRepository,
  McpAuthorizationRepository,
  OAuthAuthorizationCodeRepository,
  OAuthAuthorizationRequestRepository,
  OAuthClientRepository,
  OAuthTokenRepository,
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
import {
  ExecutionRepository,
  ExecutionSubmissionRepository,
  SessionKeyRepository,
  SessionKeyGrantRepository,
  SessionKeyPolicyReservationRepository,
  SessionKeyPolicyStateRepository,
  WalletKeyRepository,
  WalletRepository,
} from "#/repositories/core/index";
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
    apiKey: ApiKeyRepository["Service"];
    oauth: {
      authorization: McpAuthorizationRepository["Service"];
      authorizationCode: OAuthAuthorizationCodeRepository["Service"];
      authorizationRequest: OAuthAuthorizationRequestRepository["Service"];
      client: OAuthClientRepository["Service"];
      token: OAuthTokenRepository["Service"];
    };
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
  core: {
    execution: ExecutionRepository["Service"];
    executionSubmission: ExecutionSubmissionRepository["Service"];
    sessionKey: SessionKeyRepository["Service"];
    sessionKeyGrant: SessionKeyGrantRepository["Service"];
    sessionKeyPolicyReservation: SessionKeyPolicyReservationRepository["Service"];
    sessionKeyPolicyState: SessionKeyPolicyStateRepository["Service"];
    wallet: WalletRepository["Service"];
    walletKey: WalletKeyRepository["Service"];
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
      const apiKey = yield* ApiKeyRepository;
      const oauthAuthorization = yield* McpAuthorizationRepository;
      const oauthAuthorizationCode = yield* OAuthAuthorizationCodeRepository;
      const oauthAuthorizationRequest = yield* OAuthAuthorizationRequestRepository;
      const oauthClient = yield* OAuthClientRepository;
      const oauthToken = yield* OAuthTokenRepository;
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
      const wallet = yield* WalletRepository;
      const walletKey = yield* WalletKeyRepository;
      const sessionKey = yield* SessionKeyRepository;
      const sessionKeyGrant = yield* SessionKeyGrantRepository;
      const execution = yield* ExecutionRepository;
      const executionSubmission = yield* ExecutionSubmissionRepository;
      const sessionKeyPolicyReservation = yield* SessionKeyPolicyReservationRepository;
      const sessionKeyPolicyState = yield* SessionKeyPolicyStateRepository;

      return Repository.of({
        audit: {
          organization: organizationEvent,
          user: userEvent,
        },
        auth: {
          actor,
          apiKey,
          oauth: {
            authorization: oauthAuthorization,
            authorizationCode: oauthAuthorizationCode,
            authorizationRequest: oauthAuthorizationRequest,
            client: oauthClient,
            token: oauthToken,
          },
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
        core: {
          execution,
          executionSubmission,
          sessionKey,
          sessionKeyGrant,
          sessionKeyPolicyReservation,
          sessionKeyPolicyState,
          wallet,
          walletKey,
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
        ApiKeyRepository.layer,
        McpAuthorizationRepository.layer,
        OAuthAuthorizationCodeRepository.layer,
        OAuthAuthorizationRequestRepository.layer,
        OAuthClientRepository.layer,
        OAuthTokenRepository.layer,
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
        SessionKeyRepository.layer,
        SessionKeyGrantRepository.layer,
        ExecutionRepository.layer,
        ExecutionSubmissionRepository.layer,
        SessionKeyPolicyReservationRepository.layer,
        SessionKeyPolicyStateRepository.layer,
        WalletRepository.layer,
        WalletKeyRepository.layer,
      ),
    ),
  );
}
