import { Schema } from "effect";

// Organization Permissions
const orgPermissions = [
  "org:read", // Read Organization details such as name, slug, etc.
  "org:update", // Update Organization details such as name, slug, etc.
  "org:delete", // Delete an organization
] as const;

// Billing Permissions
const billingPermissions = [
  "billing:read", // Read Organization Billing details such as plan, etc.
  "billing:update", // Update Organization Billing details through payment gateway, upgrade plan, etc.
  "billing:cancel", // Cancel Organization Billing
] as const;

// Member Permissions
const memberPermissions = [
  "member:read", // Read list of all members in an organization
  "member:update", // Update a member's role
  "member:remove", // Remove a member from an organization
] as const;

// Role Permissions
const rolePermissions = [
  "role:read", // Read all roles in an organization
  "role:create", // Create a role in an organization
  "role:update", // Update existing role in an organization
  "role:delete", // Delete a role in an organization
  "role:assign", // Assign a role to a user
] as const;

// Invitation Permissions
const invitationPermissions = [
  "invitation:read", // Read Organization Invitations
  "invitation:create", // Invite a user to an organization
  "invitation:update", // Update an invitation, such as revoking it, changing the role, etc.
  "invitation:delete", // Delete an invitation
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

export const ownerRolePermissions: Permission[] = [
  ...orgPermissions,
  ...billingPermissions,
  ...memberPermissions,
  ...rolePermissions,
  ...invitationPermissions,
  ...smartAccountPermissions,
  ...sessionKeyPermissions,
];

export const memberRolePermissions: Permission[] = [
  "org:read",
  "member:read",
  "role:read",
  "smart_account:read",
  "session_key:read",
];

export const ownerRole = {
  key: "owner",
  permissions: ownerRolePermissions,
  isSystem: true,
  version: 0,
  metadata: {
    name: "Owner",
    description: "System role for the organization owner",
    logo: {
      type: "icon",
      value: "crown",
    },
  },
} as const;

export const memberRole = {
  key: "member",
  permissions: memberRolePermissions,
  isSystem: true,
  version: 0,
  metadata: {
    name: "Member",
    description: "System role for organization members",
    logo: {
      type: "icon",
      value: "user",
    },
  },
} as const;
