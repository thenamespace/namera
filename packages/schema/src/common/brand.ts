import { Schema } from "effect";

// Branded Ids

// Auth Tables
export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export const SessionId = Schema.String.pipe(Schema.brand("SessionId"));
export const AccountId = Schema.String.pipe(Schema.brand("AccountId"));
export const VerificationId = Schema.String.pipe(
  Schema.brand("VerificationId"),
);
export const OrganizationId = Schema.String.pipe(
  Schema.brand("OrganizationId"),
);
export const OrganizationMemberId = Schema.String.pipe(
  Schema.brand("OrganizationMemberId"),
);
export const OrganizationRoleId = Schema.String.pipe(
  Schema.brand("OrganizationRoleId"),
);
export const InvitationId = Schema.String.pipe(Schema.brand("InvitationId"));

// Audit Tables
export const OrganizationEventId = Schema.String.pipe(
  Schema.brand("OrganizationEventId"),
);

// Core Tables
export const SmartAccountId = Schema.String.pipe(
  Schema.brand("SmartAccountId"),
);
export const SessionKeyId = Schema.String.pipe(Schema.brand("SessionKeyId"));

export type UserId = typeof UserId.Type;
export type SessionId = typeof SessionId.Type;
export type AccountId = typeof AccountId.Type;
export type VerificationId = typeof VerificationId.Type;
export type OrganizationId = typeof OrganizationId.Type;
export type OrganizationMemberId = typeof OrganizationMemberId.Type;
export type OrganizationRoleId = typeof OrganizationRoleId.Type;
export type InvitationId = typeof InvitationId.Type;
export type OrganizationEventId = typeof OrganizationEventId.Type;
export type SmartAccountId = typeof SmartAccountId.Type;
export type SessionKeyId = typeof SessionKeyId.Type;
