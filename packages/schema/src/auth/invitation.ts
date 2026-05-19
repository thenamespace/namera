import { Schema } from "effect";

import {
  Email,
  InvitationId,
  OrganizationId,
  OrganizationRoleId,
  UserId,
} from "@/common";
import { createInsertSchema, createUpdateSchema } from "@/helpers";

export const InvitationStatus = Schema.Literals([
  "pending",
  "accepted",
  "rejected",
]);

export const Invitation = Schema.Struct({
  id: InvitationId,
  email: Email,
  roleId: OrganizationRoleId,
  organizationId: OrganizationId,
  inviterId: UserId,
  status: InvitationStatus,
  expiresAt: Schema.Date,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  deletedAt: Schema.NullOr(Schema.Date),
});

export const InvitationUpdate = createUpdateSchema(Invitation);
export const InvitationInsert = createInsertSchema(
  Invitation,
  "email",
  "roleId",
  "organizationId",
  "inviterId",
  "status",
  "expiresAt",
);

export type Invitation = typeof Invitation.Type;
export type InvitationUpdate = typeof InvitationUpdate.Type;
export type InvitationInsert = typeof InvitationInsert.Type;

export type InvitationStatus = typeof InvitationStatus.Type;
