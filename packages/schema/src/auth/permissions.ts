import { Schema } from "effect";

// Organization Permissions
const orgPermissions = ["org:read", "org:update", "org:delete"] as const;

// Billing Permissions
const billingPermissions = [
  "billing:read",
  "billing:update",
  "billing:cancel",
] as const;

// Member Permissions
const memberPermissions = [
  "member:read",
  "member:invite",
  "member:update",
  "member:remove",
] as const;

// Role Permissions
const rolePermissions = [
  "role:read",
  "role:create",
  "role:update",
  "role:delete",
  "role:assign",
] as const;

// Invitation Permissions
const invitationPermissions = [
  "invitation:read",
  "invitation:create",
  "invitation:update",
  "invitation:delete",
  "invitation:resend",
] as const;

// Smart Account Permissions
const smartAccountPermissions = [
  "smart_account:read",
  "smart_account:create",
  "smart_account:update",
  "smart_account:delete",
] as const;

// Session Key Permissions
const sessionKeyPermissions = [
  "session_key:read",
  "session_key:create",
  "session_key:update",
  "session_key:delete",
  "session_key:revoke",
] as const;

export const Permission = Schema.Literals([
  ...orgPermissions,
  ...billingPermissions,
  ...memberPermissions,
  ...rolePermissions,
  ...invitationPermissions,
  ...smartAccountPermissions,
  ...sessionKeyPermissions,
]);

export type Permission = typeof Permission.Type;

export const ownerPermissions: Permission[] = [
  ...orgPermissions,
  ...billingPermissions,
  ...memberPermissions,
  ...rolePermissions,
  ...invitationPermissions,
  ...smartAccountPermissions,
  ...sessionKeyPermissions,
];
