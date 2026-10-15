import { Schema } from "effect";

import { UserActorData } from "@namera-ai/protocol/dto";

const userId = "01900000-0000-7000-8000-000000000001";
const organizationId = "01900000-0000-7000-8000-000000000002";
const roleId = "01900000-0000-7000-8000-000000000003";
const user = {
  id: userId,
  email: "member@example.com",
  emailVerified: true,
  metadata: { version: 1, name: "Member" },
  lastLoginAt: null,
};
const role = {
  id: roleId,
  key: "wallet-editor",
  type: "custom",
  systemRoleId: null,
  metadata: { version: 1, name: "Wallet editor" },
  permissions: ["wallet:read", "wallet:create"],
};

export const actor = Schema.decodeUnknownSync(UserActorData)({
  actorId: "01900000-0000-7000-8000-000000000004",
  user,
  role,
  session: {
    id: "01900000-0000-7000-8000-000000000005",
    userId,
    activeOrganizationId: organizationId,
    ipAddress: null,
    userAgent: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    expiresAt: new Date("2026-11-01T00:00:00Z"),
    revokedAt: null,
  },
  organization: { id: organizationId, metadata: { version: 1, name: "Workspace" } },
  member: {
    organizationMember: {
      id: "01900000-0000-7000-8000-000000000006",
      userId,
      organizationId,
      organizationRoleId: roleId,
      joinedAt: new Date("2026-10-01T00:00:00Z"),
    },
    user,
    organizationRole: role,
  },
});
