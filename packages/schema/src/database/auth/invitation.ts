import { Schema, Struct } from "effect";

import {
  Email,
  InvitationId,
  OrganizationId,
  OrganizationRoleId,
  UserId,
} from "../../common";
import { TimestampFields } from "../common";
import { createInsertSchema, createUpdateSchema } from "../helpers";

export const InvitationStatus = Schema.Literals([
  "pending",
  "accepted",
  "rejected",
]);

export const Invitation = Schema.Struct({
  id: InvitationId,
  email: Email,
  organizationId: OrganizationId,
  roleId: OrganizationRoleId,
  inviterId: UserId,
  status: InvitationStatus,
  expiresAt: Schema.DateTimeUtcFromDate,
}).mapFields(Struct.assign(TimestampFields));

export const InvitationUpdate = createUpdateSchema(Invitation);
export const InvitationInsert = createInsertSchema(
  Invitation,
  "email",
  "organizationId",
  "roleId",
  "inviterId",
  "status",
  "expiresAt",
);

export type InvitationStatus = typeof InvitationStatus.Type;
export type Invitation = typeof Invitation.Type;
export type InvitationUpdate = typeof InvitationUpdate.Type;
export type InvitationInsert = typeof InvitationInsert.Type;
