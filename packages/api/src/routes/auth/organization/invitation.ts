import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

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
    }).annotate(OpenApi.Summary, "Get an invitation for the current user"),
    HttpApiEndpoint.get("listInvitations", "/list-invitations", {
      error: [InvitationError, ...CommonErrors],
      success: ListOrganizationInvitationsResponse,
    }).annotate(OpenApi.Summary, "List invitations for the active organization"),
    HttpApiEndpoint.get("listUserInvitations", "/list-user-invitations", {
      error: [InvitationError, ...CommonErrors],
      success: ListUserInvitationsResponse,
    }).annotate(OpenApi.Summary, "List invitations received by the current user"),
    HttpApiEndpoint.post("inviteMember", "/invite-member", {
      payload: InviteMemberRequest,
      error: [InvitationError, OrganizationError, ...CommonErrors],
      success: InviteMemberResponse,
    }).annotate(OpenApi.Summary, "Invite a member to the active organization"),
    HttpApiEndpoint.post("acceptInvitation", "/accept-invitation", {
      payload: AcceptInvitationRequest,
      error: [InvitationError, OrganizationError, ...CommonErrors],
      success: AcceptInvitationResponse,
    }).annotate(OpenApi.Summary, "Accept an organization invitation"),
    HttpApiEndpoint.post("rejectInvitation", "/reject-invitation", {
      payload: RejectInvitationRequest,
      error: [InvitationError, OrganizationError, ...CommonErrors],
      success: RejectInvitationResponse,
    }).annotate(OpenApi.Summary, "Reject an organization invitation"),
    HttpApiEndpoint.post("cancelInvitation", "/cancel-invitation", {
      payload: CancelInvitationRequest,
      error: [InvitationError, OrganizationError, ...CommonErrors],
      success: CancelInvitationResponse,
    }).annotate(OpenApi.Summary, "Cancel an organization invitation"),
  )
  .annotate(OpenApi.Description, "Organization invitations")
  .middleware(Authorization)
  .prefix("/auth/invitation") {}
