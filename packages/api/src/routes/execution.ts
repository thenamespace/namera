import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import { BillingErrors, ExecutionError } from "@namera-ai/protocol";
import { ExecuteRequest, ExecuteRequestHeaders, ExecuteResponse } from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class ExecutionGroup extends HttpApiGroup.make("execution")
  .add(
    HttpApiEndpoint.post("execute", "/", {
      payload: ExecuteRequest,
      headers: ExecuteRequestHeaders,
      success: ExecuteResponse,
      error: [ExecutionError, ...BillingErrors, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Execute an operation through an authorized session key"),
  )
  .annotate(OpenApi.Description, "Namespace-discriminated programmable wallet executions")
  .middleware(Authorization)
  .prefix("/executions") {}
