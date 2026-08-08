import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { InvitationError, OrganizationError } from "@namera-ai/protocol";
import {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  CancelInvitationRequest,
  CancelInvitationResponse,
  GetInvitationRequest,
  GetInvitationResponse,
  InviteMemberRequest,
  InviteMemberResponse,
  ListOrganizationInvitationsResponse,
  ListUserInvitationsResponse,
  RejectInvitationRequest,
  RejectInvitationResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class InvitationGroup extends HttpApiGroup.make("invitation")
  .add(
    HttpApiEndpoint.get("getInvitation", "/get-invitation", {
      query: GetInvitationRequest,
      error: [InvitationError, ...CommonErrors],
      success: GetInvitationResponse,
    }),
    HttpApiEndpoint.get("listInvitations", "/list-invitations", {
      error: [InvitationError, ...CommonErrors],
      success: ListOrganizationInvitationsResponse,
    }),
    HttpApiEndpoint.get("listUserInvitations", "/list-user-invitations", {
      error: [InvitationError, ...CommonErrors],
      success: ListUserInvitationsResponse,
    }),
    HttpApiEndpoint.post("inviteMember", "/invite-member", {
      payload: InviteMemberRequest,
      error: [InvitationError, OrganizationError, ...CommonErrors],
      success: InviteMemberResponse,
    }),
    HttpApiEndpoint.post("acceptInvitation", "/accept-invitation", {
      payload: AcceptInvitationRequest,
      error: [InvitationError, OrganizationError, ...CommonErrors],
      success: AcceptInvitationResponse,
    }),
    HttpApiEndpoint.post("rejectInvitation", "/reject-invitation", {
      payload: RejectInvitationRequest,
      error: [InvitationError, OrganizationError, ...CommonErrors],
      success: RejectInvitationResponse,
    }),
    HttpApiEndpoint.post("cancelInvitation", "/cancel-invitation", {
      payload: CancelInvitationRequest,
      error: [InvitationError, OrganizationError, ...CommonErrors],
      success: CancelInvitationResponse,
    }),
  )
  .middleware(Authorization)
  .prefix("/auth/invitation") {}
