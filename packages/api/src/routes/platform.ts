import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { PlatformAuthError } from "@namera-ai/protocol";
import {
  PlatformMeResponse,
  PlatformMembersResponse,
  PlatformInvitationResponse,
  CreatePlatformInvitationRequest,
  ChangePlatformRoleRequest,
  ChangePlatformStatusRequest,
  TransferPlatformOwnershipRequest,
  AcceptPlatformInvitationRequest,
} from "@namera-ai/protocol/dto";
import { PlatformMember } from "@namera-ai/protocol/model";

import { CommonErrors } from "#/common";
import { AdminAuthorization, PlatformSessionAuthorization } from "#/middlewares/admin";

const errors = [...CommonErrors, PlatformAuthError];
const params = Schema.Struct({ id: Schema.String });

export class PlatformGroup extends HttpApiGroup.make("platform")
  .add(
    HttpApiEndpoint.get("me", "/internal/me", { success: PlatformMeResponse, error: errors }),
    HttpApiEndpoint.get("members", "/internal/members", {
      success: PlatformMembersResponse,
      error: errors,
    }),
    HttpApiEndpoint.patch("changeRole", "/internal/members/:id/role", {
      params,
      payload: ChangePlatformRoleRequest,
      success: PlatformMember,
      error: errors,
    }),
    HttpApiEndpoint.patch("changeStatus", "/internal/members/:id/status", {
      params,
      payload: ChangePlatformStatusRequest,
      success: PlatformMember,
      error: errors,
    }),
    HttpApiEndpoint.delete("removeMember", "/internal/members/:id", {
      params,
      success: PlatformMember,
      error: errors,
    }),
    HttpApiEndpoint.post("transferOwnership", "/internal/ownership/transfer", {
      payload: TransferPlatformOwnershipRequest,
      error: errors,
    }),
    HttpApiEndpoint.get("invitations", "/internal/member-invitations", {
      query: Schema.Struct({ cursor: Schema.optionalKey(Schema.String) }),
      success: Schema.Array(PlatformInvitationResponse),
      error: errors,
    }),
    HttpApiEndpoint.post("invite", "/internal/member-invitations", {
      payload: CreatePlatformInvitationRequest,
      success: PlatformInvitationResponse,
      error: errors,
    }),
    HttpApiEndpoint.delete("revokeInvitation", "/internal/member-invitations/:id", {
      params,
      success: Schema.Struct({ revoked: Schema.Boolean }),
      error: errors,
    }),
  )
  .middleware(AdminAuthorization)
  .annotate(OpenApi.Exclude, true) {}

// Invitees have a verified human session but are not platform members yet.
export class PlatformInvitationGroup extends HttpApiGroup.make("platformInvitation")
  .add(
    HttpApiEndpoint.post("accept", "/auth/platform-invitations/accept", {
      payload: AcceptPlatformInvitationRequest,
      success: PlatformMember,
      error: errors,
    }),
  )
  .middleware(PlatformSessionAuthorization)
  .annotate(OpenApi.Exclude, true) {}
