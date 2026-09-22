import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import {
  CreateBetaInvitesRequest,
  CreateBetaInvitesResponse,
  ListBetaInvitesRequest,
  ListBetaInvitesResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { AdminAuthorization } from "#/middlewares/admin";

export class BetaInviteGroup extends HttpApiGroup.make("betaInvite")
  .add(
    HttpApiEndpoint.get("list", "/internal/invites", {
      query: ListBetaInvitesRequest,
      success: ListBetaInvitesResponse,
      error: CommonErrors,
    }),
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
  .middleware(AdminAuthorization)
  // Operator surface: kept out of the published spec and the Scalar reference.
  .annotate(OpenApi.Exclude, true) {}
