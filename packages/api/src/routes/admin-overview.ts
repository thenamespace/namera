import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { PlatformAuthError } from "@namera-ai/protocol";
import { GetAdminOverviewRequest, GetAdminOverviewResponse } from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { AdminAuthorization } from "#/middlewares/admin";

export class AdminOverviewGroup extends HttpApiGroup.make("adminOverview")
  .add(
    HttpApiEndpoint.get("get", "/internal/overview", {
      query: GetAdminOverviewRequest,
      success: GetAdminOverviewResponse,
      error: [...CommonErrors, PlatformAuthError],
    }),
  )
  .middleware(AdminAuthorization)
  .annotate(OpenApi.Exclude, true) {}
