import { Schema, Struct } from "effect";

import { InvitationId } from "#/common/index";
import { Invitation } from "#/model/index";

import { GetUserResponse } from "../core/index.js";
import { GetOrganizationResponse } from "./organization.js";
import { GetOrganizationRoleResponse } from "./role.js";

export const GetInvitationRequest = Schema.Struct({
  invitationId: InvitationId,
}).annotate({ identifier: "GetInvitationRequest" });
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
  organization: GetOrganizationResponse,
  organizationRole: GetOrganizationRoleResponse,
}).annotate({ identifier: "InvitationResponse" });

export const ListOrganizationInvitationsResponse = Schema.Array(GetInvitationResponse).annotate({
  identifier: "ListOrganizationInvitationsResponse",
});

export const ListUserInvitationsResponse = Schema.Array(GetInvitationResponse).annotate({
  identifier: "ListUserInvitationsResponse",
});

export const InviteMemberRequest = Invitation.mapFields(
  Struct.pick(["email", "organizationRoleId"]),
).annotate({ identifier: "InviteMemberRequest" });
export const InviteMemberResponse = GetInvitationResponse;

export const AcceptInvitationRequest = Schema.Struct({
  invitationId: InvitationId,
}).annotate({ identifier: "AcceptInvitationRequest" });
export const AcceptInvitationResponse = Schema.Void;

export const RejectInvitationRequest = Schema.Struct({
  invitationId: InvitationId,
}).annotate({ identifier: "RejectInvitationRequest" });
export const RejectInvitationResponse = Schema.Void;

export const CancelInvitationRequest = Schema.Struct({
  invitationId: InvitationId,
}).annotate({ identifier: "CancelInvitationRequest" });
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
