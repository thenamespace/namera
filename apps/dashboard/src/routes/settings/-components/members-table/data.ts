import { Schema } from "effect";

import {
  GetOrganizationRoleResponse,
  ListOrganizationMemberResponse,
} from "@namera-ai/protocol/dto";

export const demoInviteRoles = Schema.decodeUnknownSync(Schema.Array(GetOrganizationRoleResponse))([
  {
    id: "0198a9f6-1000-7000-8000-000000000032",
    key: "member",
    metadata: {
      version: 1,
      name: "Member",
      description: "Can view the organization and its members.",
    },
    type: "system",
    permissions: ["organization:read", "member:read", "role:read"],
    systemRoleId: "0198a9f6-1000-7000-8000-000000000042",
  },
  {
    id: "0198a9f6-1000-7000-8000-000000000033",
    key: "admin",
    metadata: {
      version: 1,
      name: "Admin",
      description: "Can manage the organization, members, roles, and invitations.",
    },
    type: "system",
    permissions: [
      "organization:read",
      "organization:update",
      "member:read",
      "member:update",
      "member:remove",
      "invitation:read",
      "invitation:create",
      "invitation:cancel",
      "role:read",
      "role:create",
      "role:update",
      "role:delete",
      "billing:read",
    ],
    systemRoleId: "0198a9f6-1000-7000-8000-000000000043",
  },
]);

export const demoMembers = Schema.decodeUnknownSync(ListOrganizationMemberResponse)([
  {
    organizationMember: {
      id: "0198a9f6-1000-7000-8000-000000000001",
      userId: "0198a9f6-1000-7000-8000-000000000011",
      organizationId: "0198a9f6-1000-7000-8000-000000000021",
      organizationRoleId: "0198a9f6-1000-7000-8000-000000000031",
      joinedAt: new Date("2026-06-01T08:30:00.000Z"),
    },
    user: {
      id: "0198a9f6-1000-7000-8000-000000000011",
      email: "alice@namera.local",
      emailVerified: true,
      metadata: {
        version: 1,
        name: "Alice",
        image: { type: "emoji", value: "👩🏽‍💻" },
      },
      lastLoginAt: new Date("2026-08-12T09:42:00.000Z"),
    },
    organizationRole: {
      id: "0198a9f6-1000-7000-8000-000000000031",
      key: "owner",
      metadata: { version: 1, name: "Owner" },
      type: "system",
      permissions: [],
      systemRoleId: "0198a9f6-1000-7000-8000-000000000041",
    },
  },
  {
    organizationMember: {
      id: "0198a9f6-1000-7000-8000-000000000002",
      userId: "0198a9f6-1000-7000-8000-000000000012",
      organizationId: "0198a9f6-1000-7000-8000-000000000021",
      organizationRoleId: "0198a9f6-1000-7000-8000-000000000032",
      joinedAt: new Date("2026-06-04T11:15:00.000Z"),
    },
    user: {
      id: "0198a9f6-1000-7000-8000-000000000012",
      email: "bob@namera.local",
      emailVerified: true,
      metadata: {
        version: 1,
        name: "Bob",
        image: { type: "emoji", value: "🧑🏾‍🚀" },
      },
      lastLoginAt: new Date("2026-08-10T14:18:00.000Z"),
    },
    organizationRole: {
      id: "0198a9f6-1000-7000-8000-000000000032",
      key: "member",
      metadata: { version: 1, name: "Member" },
      type: "system",
      permissions: [],
      systemRoleId: "0198a9f6-1000-7000-8000-000000000042",
    },
  },
  {
    organizationMember: {
      id: "0198a9f6-1000-7000-8000-000000000003",
      userId: "0198a9f6-1000-7000-8000-000000000013",
      organizationId: "0198a9f6-1000-7000-8000-000000000021",
      organizationRoleId: "0198a9f6-1000-7000-8000-000000000032",
      joinedAt: new Date("2026-06-09T05:45:00.000Z"),
    },
    user: {
      id: "0198a9f6-1000-7000-8000-000000000013",
      email: "charlie@namera.local",
      emailVerified: true,
      metadata: {
        version: 1,
        name: "Charlie",
        image: { type: "emoji", value: "🧑🏻‍🎨" },
      },
      lastLoginAt: null,
    },
    organizationRole: {
      id: "0198a9f6-1000-7000-8000-000000000032",
      key: "member",
      metadata: { version: 1, name: "Member" },
      type: "system",
      permissions: [],
      systemRoleId: "0198a9f6-1000-7000-8000-000000000042",
    },
  },
]);
