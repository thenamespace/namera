import { Schema } from "effect";

import { Email, InvitationId, OrganizationId, OrganizationMemberId } from "@namera-ai/protocol";

export const testEmail = (value: string) => Schema.decodeSync(Email)(value);

export const organizationMetadata = (name: string) => ({ version: 1 as const, name });

export const userMetadata = (name: string) => ({ version: 1 as const, name });

export const missingOrganizationId = Schema.decodeSync(OrganizationId)(
  "01900000-0000-7000-8000-000000000001",
);

export const missingInvitationId = Schema.decodeSync(InvitationId)(
  "01900000-0000-7000-8000-000000000002",
);

export const missingOrganizationMemberId = Schema.decodeSync(OrganizationMemberId)(
  "01900000-0000-7000-8000-000000000003",
);
