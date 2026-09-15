import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { CreateBetaInvitesRequest, CreateBetaInvitesResponse } from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { InviteAdmin } from "#/middlewares/invite-admin";

export class BetaInviteGroup extends HttpApiGroup.make("betaInvite")
  .add(
    HttpApiEndpoint.post("create", "/internal/invites", {
      payload: CreateBetaInvitesRequest,
      success: CreateBetaInvitesResponse,
      error: CommonErrors,
    }),
    HttpApiEndpoint.delete("revoke", "/internal/invites/:id", {
      params: { id: Schema.String.check(Schema.isUUID()) },
      success: Schema.Struct({ revoked: Schema.Boolean }),
      error: CommonErrors,
    }),
  )
  .middleware(InviteAdmin) {}
