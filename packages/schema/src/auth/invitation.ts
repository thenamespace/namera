import { Schema } from "effect";

import { Email, OrganizationId, UserId } from "@/common";
import { createInsertSchema, createUpdateSchema } from "@/helpers";

import { OrganizationMemberRole } from "./member";

export const InvitationStatus = Schema.Literals([
  "pending",
  "accepted",
  "rejected",
]);

export const Invitation = Schema.Struct({
  id: Schema.String,
  email: Email,
  role: OrganizationMemberRole,
  organizationId: OrganizationId,
  expiresAt: Schema.Date,
  inviterId: UserId,
  status: Schema.Literals(["pending", "accepted", "rejected"]),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export const InvitationUpdate = createUpdateSchema(Invitation);
export const InvitationInsert = createInsertSchema(
  Invitation,
  "email",
  "role",
  "organizationId",
  "expiresAt",
  "inviterId",
);

export type Invitation = typeof Invitation.Type;
export type InvitationUpdate = typeof InvitationUpdate.Type;
export type InvitationInsert = typeof InvitationInsert.Type;

export type InvitationStatus = typeof InvitationStatus.Type;
