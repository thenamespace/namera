import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import {
  BillingErrors,
  ExecutionError,
  ExecutionNotFoundError,
  ExecutionSubmissionNotFoundError,
} from "@namera-ai/protocol";
import {
  ExecuteRequestHeaders,
  PrepareExecutionRequest,
  PrepareExecutionResponse,
  CompleteExecutionRequest,
  CompleteExecutionResponse,
  PrepareManagedExecutionRequest,
  PrepareManagedExecutionResponse,
  CompleteManagedExecutionRequest,
  GetExecutionRequest,
  GetExecutionResponse,
  GetExecutionSubmissionRequest,
  GetExecutionSubmissionResponse,
  ListExecutionsRequest,
  ListExecutionsResponse,
  SimulateExecutionRequest,
  SimulateExecutionResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class ExecutionGroup extends HttpApiGroup.make("execution")
  .add(
    HttpApiEndpoint.post("prepareManaged", "/managed/prepare", {
      payload: PrepareManagedExecutionRequest,
      headers: ExecuteRequestHeaders,
      success: PrepareManagedExecutionResponse,
      error: [ExecutionError, ...BillingErrors, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Prepare an execution for a 1Claw-managed session"),
    HttpApiEndpoint.post("completeManaged", "/managed/complete", {
      payload: CompleteManagedExecutionRequest,
      success: CompleteExecutionResponse,
      error: [ExecutionError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Sign the stored managed execution and queue it for broadcast"),
    HttpApiEndpoint.post("prepare", "/prepare", {
      payload: PrepareExecutionRequest,
      headers: ExecuteRequestHeaders,
      success: PrepareExecutionResponse,
      error: [ExecutionError, ...BillingErrors, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Prepare an operation for a locally held session signer"),
    HttpApiEndpoint.post("complete", "/complete", {
      payload: CompleteExecutionRequest,
      success: CompleteExecutionResponse,
      error: [ExecutionError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Accept a local signature and queue the exact prepared operation"),
  )
  .add(
    HttpApiEndpoint.post("simulate", "/simulate", {
      payload: SimulateExecutionRequest,
      success: SimulateExecutionResponse,
      error: [ExecutionError, ...CommonErrors],
    }).annotate(
      OpenApi.Summary,
      "Simulate an operation and evaluate authorized session-key policies",
    ),
  )
  .add(
    HttpApiEndpoint.get("getSubmission", "/submissions/:submissionId", {
      params: GetExecutionSubmissionRequest,
      success: GetExecutionSubmissionResponse,
      error: [ExecutionSubmissionNotFoundError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Get the status of an API key's execution submission"),
    HttpApiEndpoint.get("get", "/:executionId", {
      params: GetExecutionRequest,
      success: GetExecutionResponse,
      error: [ExecutionNotFoundError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Get a confirmed execution"),
    HttpApiEndpoint.get("list", "/", {
      query: ListExecutionsRequest,
      success: ListExecutionsResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "List confirmed executions for the active organization"),
  )
  .annotate(OpenApi.Description, "Namespace-discriminated programmable wallet executions")
  .middleware(Authorization)
  .prefix("/executions") {}
