import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import { GetDashboardOverviewResponse } from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class DashboardGroup extends HttpApiGroup.make("dashboard")
  .add(
    HttpApiEndpoint.get("getOverview", "/dashboard/overview", {
      success: GetDashboardOverviewResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "Get the active organization's operational overview"),
  )
  .annotate(OpenApi.Description, "Organization dashboard projections")
  .middleware(Authorization) {}
