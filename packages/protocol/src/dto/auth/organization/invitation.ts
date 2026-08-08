import { Schema, Struct } from "effect";

import { InvitationId } from "#/common/index";
import { Invitation } from "#/model/index";

import { GetUserResponse } from "../core/index.js";
import { GetOrganizationRoleResponse } from "./role.js";

export const GetInvitationRequest = Schema.Struct({
  invitationId: InvitationId,
});
export const GetInvitationResponse = Schema.Struct({
  invitation: Invitation.mapFields(
    Struct.pick([
      "id",
      "inviterId",
      "organizationId",
      "organizationRoleId",
      "email",
      "status",
      "expiresAt",
    ]),
  ),
  inviter: GetUserResponse,
  organizationRole: GetOrganizationRoleResponse,
});

export const ListOrganizationInvitationsResponse = Schema.mutable(
  Schema.Array(GetInvitationResponse),
);

export const ListUserInvitationsResponse = Schema.mutable(Schema.Array(GetInvitationResponse));

export const InviteMemberRequest = Invitation.mapFields(
  Struct.pick(["email", "organizationRoleId"]),
);
export const InviteMemberResponse = GetInvitationResponse;

export const AcceptInvitationRequest = Schema.Struct({
  invitationId: InvitationId,
});
export const AcceptInvitationResponse = Schema.Void;

export const RejectInvitationRequest = Schema.Struct({
  invitationId: InvitationId,
});
export const RejectInvitationResponse = Schema.Void;

export const CancelInvitationRequest = Schema.Struct({
  invitationId: InvitationId,
});
export const CancelInvitationResponse = Schema.Void;

export type GetInvitationRequest = typeof GetInvitationRequest.Type;
export type GetInvitationResponse = typeof GetInvitationResponse.Type;
export type ListOrganizationInvitationsResponse = typeof ListOrganizationInvitationsResponse.Type;
export type ListUserInvitationsResponse = typeof ListUserInvitationsResponse.Type;
export type InviteMemberRequest = typeof InviteMemberRequest.Type;
export type InviteMemberResponse = typeof InviteMemberResponse.Type;
export type AcceptInvitationRequest = typeof AcceptInvitationRequest.Type;
export type AcceptInvitationResponse = typeof AcceptInvitationResponse.Type;
export type RejectInvitationRequest = typeof RejectInvitationRequest.Type;
export type RejectInvitationResponse = typeof RejectInvitationResponse.Type;
export type CancelInvitationRequest = typeof CancelInvitationRequest.Type;
export type CancelInvitationResponse = typeof CancelInvitationResponse.Type;
