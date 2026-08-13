import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import { GetBillingResponse } from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class BillingGroup extends HttpApiGroup.make("billing")
  .add(
    HttpApiEndpoint.get("get", "/billing", {
      success: GetBillingResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "Get billing for the active organization"),
  )
  .annotate(OpenApi.Description, "Organization billing and entitlements")
  .middleware(Authorization) {}
