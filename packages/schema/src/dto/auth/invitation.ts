import { Schema } from "effect";

import { Invitation } from "@/auth";
import { Email, OrganizationId, OrganizationRoleId } from "@/common";

export class InvitationError extends Schema.TaggedErrorClass<InvitationError>()(
  "InvitationError",
  {
    code: Schema.Literals([]),
    message: Schema.optional(Schema.String),
  },
) {}

export const InviteMemberRequest = Schema.Struct({
  email: Email,
  roleId: OrganizationRoleId,
  organizationId: OrganizationId,
});
export const InviteMemberResponse = Schema.Void;

export const AcceptInvitationRequest = Schema.Struct({
  invitationId: Schema.String,
});
export const AcceptInvitationResponse = Schema.Void;

export const CancelInvitationRequest = Schema.Struct({
  invitationId: Schema.String,
});
export const CancelInvitationResponse = Schema.Void;

export const RejectInvitationRequest = Schema.Struct({
  invitationId: Schema.String,
});
export const RejectInvitationResponse = Schema.Void;

export const GetInvitationRequest = Schema.Struct({
  invitationId: Schema.String,
});
export const GetInvitationResponse = Invitation;

export const ListInvitationsRequest = Schema.Struct({
  organizationId: OrganizationId,
});
export const ListInvitationsResponse = Schema.Array(Invitation);

export type InviteMemberRequest = typeof InviteMemberRequest.Type;
export type InviteMemberResponse = typeof InviteMemberResponse.Type;
export type AcceptInvitationRequest = typeof AcceptInvitationRequest.Type;
export type AcceptInvitationResponse = typeof AcceptInvitationResponse.Type;
export type CancelInvitationRequest = typeof CancelInvitationRequest.Type;
export type CancelInvitationResponse = typeof CancelInvitationResponse.Type;
export type RejectInvitationRequest = typeof RejectInvitationRequest.Type;
export type RejectInvitationResponse = typeof RejectInvitationResponse.Type;
export type GetInvitationRequest = typeof GetInvitationRequest.Type;
export type GetInvitationResponse = typeof GetInvitationResponse.Type;
export type ListInvitationsRequest = typeof ListInvitationsRequest.Type;
export type ListInvitationsResponse = typeof ListInvitationsResponse.Type;
