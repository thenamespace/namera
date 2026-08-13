/**
 * Branded Ids for Database Primary Keys and Foreign Keys
 */
import { Schema } from "effect";

export const createBrandedId = <T extends string>(brand: T) =>
  Schema.String.pipe(Schema.brand(brand), Schema.check(Schema.isUUID(7)));

// Auth Core Tables
export const UserId = createBrandedId("UserId");
export const SessionId = createBrandedId("SessionId");
export const AccountId = createBrandedId("AccountId");
export const VerificationId = createBrandedId("VerificationId");
export const ActorId = createBrandedId("ActorId");

// Auth Organization Tables
export const OrganizationId = createBrandedId("OrganizationId");
export const OrganizationMemberId = createBrandedId("OrganizationMemberId");
export const OrganizationRoleId = createBrandedId("OrganizationRoleId");
export const InvitationId = createBrandedId("InvitationId");
export const SystemRoleId = createBrandedId("SystemRoleId");

// Core Tables
export const WalletKeyId = createBrandedId("WalletKeyId");
export const WalletId = createBrandedId("WalletId");

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
export const BillingProviderEventId = createBrandedId("BillingProviderEventId");

export type UserId = typeof UserId.Type;
export type SessionId = typeof SessionId.Type;
export type AccountId = typeof AccountId.Type;
export type VerificationId = typeof VerificationId.Type;
export type ActorId = typeof ActorId.Type;
export type OrganizationId = typeof OrganizationId.Type;
export type OrganizationMemberId = typeof OrganizationMemberId.Type;
export type OrganizationRoleId = typeof OrganizationRoleId.Type;
export type InvitationId = typeof InvitationId.Type;
export type SystemRoleId = typeof SystemRoleId.Type;
export type WalletKeyId = typeof WalletKeyId.Type;
export type WalletId = typeof WalletId.Type;
export type UserEventId = typeof UserEventId.Type;
export type OrganizationEventId = typeof OrganizationEventId.Type;
export type EmailJobId = typeof EmailJobId.Type;
export type NotificationId = typeof NotificationId.Type;
export type NotificationPreferenceId = typeof NotificationPreferenceId.Type;
export type BillingSubscriptionId = typeof BillingSubscriptionId.Type;
export type BillingProviderEventId = typeof BillingProviderEventId.Type;
