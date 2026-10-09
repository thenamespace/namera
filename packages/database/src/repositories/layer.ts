import { Context, Effect, Layer } from "effect";

import type { Database } from "#/core/index";
import { OrganizationEventRepository, UserEventRepository } from "#/repositories/audit/index";
import {
  ActorRepository,
  PlatformRepository,
  AccountRepository,
  BetaInviteRepository,
  WaitlistRepository,
  ApiKeyRepository,
  OAuthAuthorizationRepository,
  OAuthAuthorizationCodeRepository,
  OAuthAuthorizationRequestRepository,
  OAuthClientRepository,
  OAuthDeviceAuthorizationRepository,
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
  BillingMeterBalanceRepository,
  BillingPeriodRepository,
  BillingProviderEventRepository,
  BillingSubscriptionRepository,
  BillingSubscriptionItemRepository,
  BillingUsageDeliveryRepository,
  BillingUsageEventRepository,
  BillingUsageRepository,
  BillingUsageReservationRepository,
} from "#/repositories/billing/index";
import {
  AdminOverviewRepository,
  CredentialsRepository,
  DashboardOverviewRepository,
  ExecutionRepository,
  ExecutionSubmissionRepository,
  SessionKeyRepository,
  SessionKeyInstallationRepository,
  SessionKeyOperationRepository,
  SessionKeyGrantRepository,
  SessionKeyPolicyReservationRepository,
  SessionKeyPolicyStateRepository,
  SigningKeyRepository,
  SignatureOperationRepository,
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
    platform: PlatformRepository["Service"];
    account: AccountRepository["Service"];
    betaInvite: BetaInviteRepository["Service"];
    waitlist: WaitlistRepository["Service"];
    actor: ActorRepository["Service"];
    apiKey: ApiKeyRepository["Service"];
    oauth: {
      authorization: OAuthAuthorizationRepository["Service"];
      authorizationCode: OAuthAuthorizationCodeRepository["Service"];
      authorizationRequest: OAuthAuthorizationRequestRepository["Service"];
      client: OAuthClientRepository["Service"];
      deviceAuthorization: OAuthDeviceAuthorizationRepository["Service"];
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
    meterBalance: BillingMeterBalanceRepository["Service"];
    period: BillingPeriodRepository["Service"];
    providerEvent: BillingProviderEventRepository["Service"];
    subscription: BillingSubscriptionRepository["Service"];
    subscriptionItem: BillingSubscriptionItemRepository["Service"];
    usageDelivery: BillingUsageDeliveryRepository["Service"];
    usageEvent: BillingUsageEventRepository["Service"];
    usageReservation: BillingUsageReservationRepository["Service"];
    usage: BillingUsageRepository["Service"];
  };
  core: {
    credentials: CredentialsRepository["Service"];
    adminOverview: AdminOverviewRepository["Service"];
    dashboardOverview: DashboardOverviewRepository["Service"];
    execution: ExecutionRepository["Service"];
    executionSubmission: ExecutionSubmissionRepository["Service"];
    sessionKey: SessionKeyRepository["Service"];
    sessionKeyInstallation: SessionKeyInstallationRepository["Service"];
    sessionKeyOperation: SessionKeyOperationRepository["Service"];
    sessionKeyGrant: SessionKeyGrantRepository["Service"];
    sessionKeyPolicyReservation: SessionKeyPolicyReservationRepository["Service"];
    sessionKeyPolicyState: SessionKeyPolicyStateRepository["Service"];
    signingKey: SigningKeyRepository["Service"];
    signatureOperation: SignatureOperationRepository["Service"];
    wallet: WalletRepository["Service"];
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
      const platform = yield* PlatformRepository;
      const account = yield* AccountRepository;
      const betaInvite = yield* BetaInviteRepository;
      const waitlist = yield* WaitlistRepository;
      const apiKey = yield* ApiKeyRepository;
      const oauthAuthorization = yield* OAuthAuthorizationRepository;
      const oauthAuthorizationCode = yield* OAuthAuthorizationCodeRepository;
      const oauthAuthorizationRequest = yield* OAuthAuthorizationRequestRepository;
      const oauthClient = yield* OAuthClientRepository;
      const oauthDeviceAuthorization = yield* OAuthDeviceAuthorizationRepository;
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
      const billingMeterBalance = yield* BillingMeterBalanceRepository;
      const billingPeriod = yield* BillingPeriodRepository;
      const billingProviderEvent = yield* BillingProviderEventRepository;
      const billingSubscription = yield* BillingSubscriptionRepository;
      const billingSubscriptionItem = yield* BillingSubscriptionItemRepository;
      const billingUsageDelivery = yield* BillingUsageDeliveryRepository;
      const billingUsageEvent = yield* BillingUsageEventRepository;
      const billingUsageReservation = yield* BillingUsageReservationRepository;
      const billingUsage = yield* BillingUsageRepository;
      const wallet = yield* WalletRepository;
      const dashboardOverview = yield* DashboardOverviewRepository;
      const adminOverview = yield* AdminOverviewRepository;
      const sessionKey = yield* SessionKeyRepository;
      const sessionKeyInstallation = yield* SessionKeyInstallationRepository;
      const sessionKeyOperation = yield* SessionKeyOperationRepository;
      const sessionKeyGrant = yield* SessionKeyGrantRepository;
      const execution = yield* ExecutionRepository;
      const executionSubmission = yield* ExecutionSubmissionRepository;
      const sessionKeyPolicyReservation = yield* SessionKeyPolicyReservationRepository;
      const sessionKeyPolicyState = yield* SessionKeyPolicyStateRepository;
      const signingKey = yield* SigningKeyRepository;
      const credentials = yield* CredentialsRepository;
      const signatureOperation = yield* SignatureOperationRepository;

      return Repository.of({
        audit: {
          organization: organizationEvent,
          user: userEvent,
        },
        auth: {
          platform,
          account,
          betaInvite,
          waitlist,
          actor,
          apiKey,
          oauth: {
            authorization: oauthAuthorization,
            authorizationCode: oauthAuthorizationCode,
            authorizationRequest: oauthAuthorizationRequest,
            client: oauthClient,
            deviceAuthorization: oauthDeviceAuthorization,
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
          meterBalance: billingMeterBalance,
          period: billingPeriod,
          providerEvent: billingProviderEvent,
          subscription: billingSubscription,
          subscriptionItem: billingSubscriptionItem,
          usageDelivery: billingUsageDelivery,
          usageEvent: billingUsageEvent,
          usageReservation: billingUsageReservation,
          usage: billingUsage,
        },
        core: {
          credentials,
          adminOverview,
          dashboardOverview,
          execution,
          executionSubmission,
          sessionKey,
          sessionKeyInstallation,
          sessionKeyOperation,
          sessionKeyGrant,
          sessionKeyPolicyReservation,
          sessionKeyPolicyState,
          signingKey,
          signatureOperation,
          wallet,
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
        PlatformRepository.layer,
        AccountRepository.layer,
        BetaInviteRepository.layer,
        WaitlistRepository.layer,
        DashboardOverviewRepository.layer,
        AdminOverviewRepository.layer,
        ApiKeyRepository.layer,
        OAuthAuthorizationRepository.layer,
        OAuthAuthorizationCodeRepository.layer,
        OAuthAuthorizationRequestRepository.layer,
        OAuthClientRepository.layer,
        OAuthDeviceAuthorizationRepository.layer,
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
        BillingMeterBalanceRepository.layer,
        BillingPeriodRepository.layer,
        BillingProviderEventRepository.layer,
        BillingSubscriptionRepository.layer,
        BillingSubscriptionItemRepository.layer,
        BillingUsageDeliveryRepository.layer,
        BillingUsageEventRepository.layer,
        BillingUsageReservationRepository.layer,
        BillingUsageRepository.layer,
        SessionKeyRepository.layer,
        SessionKeyInstallationRepository.layer,
        SessionKeyOperationRepository.layer,
        SessionKeyGrantRepository.layer,
        ExecutionRepository.layer,
        ExecutionSubmissionRepository.layer,
        SessionKeyPolicyReservationRepository.layer,
        SessionKeyPolicyStateRepository.layer,
        SigningKeyRepository.layer,
        CredentialsRepository.layer,
        SignatureOperationRepository.layer,
        WalletRepository.layer,
      ),
    ),
  );
}
