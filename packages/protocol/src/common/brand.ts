/**
 * Branded Ids for Database Primary Keys and Foreign Keys
 */
import { Schema } from "effect";

export const createBrandedId = <T extends string>(brand: Parameters<typeof Schema.brand<T>>[0]) =>
  Schema.String.pipe(Schema.brand<T>(brand), Schema.check(Schema.isUUID(7)));

// Auth Core Tables
export const UserId = createBrandedId("UserId");
export const SessionId = createBrandedId("SessionId");
export const AccountId = createBrandedId("AccountId");
export const VerificationId = createBrandedId("VerificationId");
export const ActorId = createBrandedId("ActorId");
export const ApiKeyId = createBrandedId("ApiKeyId");
export const OAuthClientId = createBrandedId("OAuthClientId");
export const OAuthAuthorizationRequestId = createBrandedId("OAuthAuthorizationRequestId");
export const OAuthAuthorizationId = createBrandedId("OAuthAuthorizationId");
export const OAuthDeviceAuthorizationId = createBrandedId("OAuthDeviceAuthorizationId");
export const OAuthAuthorizationCodeId = createBrandedId("OAuthAuthorizationCodeId");
export const OAuthTokenId = createBrandedId("OAuthTokenId");
export const OAuthTokenFamilyId = createBrandedId("OAuthTokenFamilyId");

// Auth Organization Tables
export const OrganizationId = createBrandedId("OrganizationId");
export const OrganizationMemberId = createBrandedId("OrganizationMemberId");
export const OrganizationRoleId = createBrandedId("OrganizationRoleId");
export const InvitationId = createBrandedId("InvitationId");
export const SystemRoleId = createBrandedId("SystemRoleId");

// Core Tables
export const WalletKeyId = createBrandedId("WalletKeyId");
export const SigningKeyId = createBrandedId("SigningKeyId");
export const CredentialId = createBrandedId("CredentialId");
export const WalletId = createBrandedId("WalletId");
export const SessionKeyId = createBrandedId("SessionKeyId");
export const SessionKeyInstallationId = createBrandedId("SessionKeyInstallationId");
export const SessionKeyOperationId = createBrandedId("SessionKeyOperationId");
export const SessionKeyGrantId = createBrandedId("SessionKeyGrantId");
export const PolicyId = createBrandedId("PolicyId");
export const SessionKeyPolicyStateId = createBrandedId("SessionKeyPolicyStateId");
export const SessionKeyPolicyReservationId = createBrandedId("SessionKeyPolicyReservationId");
export const ExecutionSubmissionId = createBrandedId("ExecutionSubmissionId");
export const ExecutionId = createBrandedId("ExecutionId");
export const SignatureOperationId = createBrandedId("SignatureOperationId");

// Audit Tables
export const UserEventId = createBrandedId("UserEventId");
export const OrganizationEventId = createBrandedId("OrganizationEventId");

// Job Tables
export const EmailJobId = createBrandedId("EmailJobId");

// Notification Tables
export const NotificationId = createBrandedId("NotificationId");
export const NotificationPreferenceId = createBrandedId("NotificationPreferenceId");

// Billing Tables
export const BillingSubscriptionId = createBrandedId("BillingSubscriptionId");
export const BillingSubscriptionItemId = createBrandedId("BillingSubscriptionItemId");
export const BillingPeriodId = createBrandedId("BillingPeriodId");
export const BillingUsageReservationId = createBrandedId("BillingUsageReservationId");
export const BillingUsageEventId = createBrandedId("BillingUsageEventId");
export const BillingUsageDeliveryId = createBrandedId("BillingUsageDeliveryId");
export const BillingProviderEventId = createBrandedId("BillingProviderEventId");

export type UserId = typeof UserId.Type;
export type SessionId = typeof SessionId.Type;
export type AccountId = typeof AccountId.Type;
export type VerificationId = typeof VerificationId.Type;
export type ActorId = typeof ActorId.Type;
export type ApiKeyId = typeof ApiKeyId.Type;
export type OAuthClientId = typeof OAuthClientId.Type;
export type OAuthAuthorizationRequestId = typeof OAuthAuthorizationRequestId.Type;
export type OAuthAuthorizationId = typeof OAuthAuthorizationId.Type;
export type OAuthDeviceAuthorizationId = typeof OAuthDeviceAuthorizationId.Type;
export type OAuthAuthorizationCodeId = typeof OAuthAuthorizationCodeId.Type;
export type OAuthTokenId = typeof OAuthTokenId.Type;
export type OAuthTokenFamilyId = typeof OAuthTokenFamilyId.Type;
export type OrganizationId = typeof OrganizationId.Type;
export type OrganizationMemberId = typeof OrganizationMemberId.Type;
export type OrganizationRoleId = typeof OrganizationRoleId.Type;
export type InvitationId = typeof InvitationId.Type;
export type SystemRoleId = typeof SystemRoleId.Type;
export type WalletKeyId = typeof WalletKeyId.Type;
export type SigningKeyId = typeof SigningKeyId.Type;
export type CredentialId = typeof CredentialId.Type;
export type WalletId = typeof WalletId.Type;
export type SessionKeyId = typeof SessionKeyId.Type;
export type SessionKeyInstallationId = typeof SessionKeyInstallationId.Type;
export type SessionKeyOperationId = typeof SessionKeyOperationId.Type;
export type SessionKeyGrantId = typeof SessionKeyGrantId.Type;
export type PolicyId = typeof PolicyId.Type;
export type SessionKeyPolicyStateId = typeof SessionKeyPolicyStateId.Type;
export type SessionKeyPolicyReservationId = typeof SessionKeyPolicyReservationId.Type;
export type ExecutionSubmissionId = typeof ExecutionSubmissionId.Type;
export type ExecutionId = typeof ExecutionId.Type;
export type SignatureOperationId = typeof SignatureOperationId.Type;
export type UserEventId = typeof UserEventId.Type;
export type OrganizationEventId = typeof OrganizationEventId.Type;
export type EmailJobId = typeof EmailJobId.Type;
export type NotificationId = typeof NotificationId.Type;
export type NotificationPreferenceId = typeof NotificationPreferenceId.Type;
export type BillingSubscriptionId = typeof BillingSubscriptionId.Type;
export type BillingSubscriptionItemId = typeof BillingSubscriptionItemId.Type;
export type BillingPeriodId = typeof BillingPeriodId.Type;
export type BillingUsageReservationId = typeof BillingUsageReservationId.Type;
export type BillingUsageEventId = typeof BillingUsageEventId.Type;
export type BillingUsageDeliveryId = typeof BillingUsageDeliveryId.Type;
export type BillingProviderEventId = typeof BillingProviderEventId.Type;
