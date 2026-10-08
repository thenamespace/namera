import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { PlatformAuthError } from "@namera-ai/protocol";
import {
  CreateBetaInvitesRequest,
  CreateBetaInvitesResponse,
  ListBetaInvitesRequest,
  ListBetaInvitesResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { AdminAuthorization } from "#/middlewares/admin";

const errors = [...CommonErrors, PlatformAuthError];

export class BetaInviteGroup extends HttpApiGroup.make("betaInvite")
  .add(
    HttpApiEndpoint.get("list", "/internal/invites", {
      query: ListBetaInvitesRequest,
      success: ListBetaInvitesResponse,
      error: errors,
    }),
    HttpApiEndpoint.post("create", "/internal/invites", {
      payload: CreateBetaInvitesRequest,
      success: CreateBetaInvitesResponse,
      error: errors,
    }),
    HttpApiEndpoint.delete("revoke", "/internal/invites/:id", {
      params: Schema.Struct({ id: Schema.String }),
      success: Schema.Struct({ revoked: Schema.Boolean }),
      error: errors,
    }),
  )
  .middleware(AdminAuthorization)
  .annotate(OpenApi.Exclude, true) {}
