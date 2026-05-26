import { Schema } from "effect";

import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import {
  DatabaseError,
  InvitationError,
  InviteMemberRequest,
  ListInvitationsRequest,
  ListInvitationsResponse,
} from "@namera-ai/schema";

export const invitationGroup = HttpApiGroup.make("invitation")
  .add(
    HttpApiEndpoint.post("inviteMember", "/invite-member", {
      payload: InviteMemberRequest,
      error: [InvitationError, DatabaseError],
      success: Schema.Void,
    }),
  )
  .add(
    HttpApiEndpoint.get("list", "/list", {
      success: ListInvitationsResponse,
      error: [DatabaseError, InvitationError],
      query: ListInvitationsRequest,
    }),
  )
  .prefix("/auth/invitation");
