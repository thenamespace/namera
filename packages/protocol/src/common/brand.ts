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

// Auth Organization Tables
export const OrganizationId = createBrandedId("OrganizationId");
export const OrganizationMemberId = createBrandedId("OrganizationMemberId");
export const OrganizationRoleId = createBrandedId("OrganizationRoleId");
export const InvitationId = createBrandedId("InvitationId");
export const SystemRoleId = createBrandedId("SystemRoleId");

export type UserId = typeof UserId.Type;
export type SessionId = typeof SessionId.Type;
export type AccountId = typeof AccountId.Type;
export type VerificationId = typeof VerificationId.Type;
export type OrganizationId = typeof OrganizationId.Type;
export type OrganizationMemberId = typeof OrganizationMemberId.Type;
export type OrganizationRoleId = typeof OrganizationRoleId.Type;
export type InvitationId = typeof InvitationId.Type;
export type SystemRoleId = typeof SystemRoleId.Type;
