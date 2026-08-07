import { Schema, Struct } from "effect";

import { Email, InvitationId, OrganizationId, OrganizationRoleId, UserId } from "#/common/index";
import { TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

export const InvitationStatus = Schema.Literals([
  "pending",
  "accepted",
  "rejected",
  "canceled",
  "expired",
]);

export const Invitation = Schema.Struct({
  id: InvitationId,
  email: Email,
  organizationId: OrganizationId,
  organizationRoleId: OrganizationRoleId,
  inviterId: UserId,
  status: InvitationStatus,
  expiresAt: Schema.DateTimeUtcFromDate,
}).mapFields(Struct.assign(TimestampFields));

export const InvitationUpdate = createUpdateSchema(Invitation);
export const InvitationInsert = createInsertSchema(
  Invitation,
  "email",
  "organizationId",
  "organizationRoleId",
  "inviterId",
  "status",
  "expiresAt",
);

export type InvitationStatus = typeof InvitationStatus.Type;
export type Invitation = typeof Invitation.Type;
export type InvitationUpdate = typeof InvitationUpdate.Type;
export type InvitationInsert = typeof InvitationInsert.Type;
