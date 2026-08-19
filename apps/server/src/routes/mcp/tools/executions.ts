import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";

import { Application } from "@namera-ai/application";
import {
  ExecuteResponse,
  GetExecutionRequest,
  GetExecutionResponse,
  GetExecutionSubmissionRequest,
  GetExecutionSubmissionResponse,
  ListExecutionsRequest,
  ListExecutionsResponse,
  McpExecuteRequest,
} from "@namera-ai/protocol/dto";

import { executionHints, readOnlyHints, registerMcpTool } from "./register.js";

const ExecuteTransaction = Tool.make("execute_transaction", {
  description:
    "Execute a namespace-specific transaction through one delegated session key whose policies authorize the complete operation.",
  parameters: McpExecuteRequest,
  success: Schema.Struct({ execution: ExecuteResponse }),
});

const GetExecutionSubmission = Tool.make("get_execution_submission", {
  description: "Get the current status of an execution submission created by this authorization.",
  parameters: GetExecutionSubmissionRequest,
  success: Schema.Struct({ submission: GetExecutionSubmissionResponse }),
});

const GetExecution = Tool.make("get_execution", {
  description: "Get one confirmed execution created by this authorization.",
  parameters: GetExecutionRequest,
  success: Schema.Struct({ execution: GetExecutionResponse }),
});

const ListExecutions = Tool.make("list_executions", {
  description: "List confirmed executions created by this authorization using cursor pagination.",
  parameters: ListExecutionsRequest,
  success: ListExecutionsResponse,
});

export const ExecutionTools = Effect.gen(function* () {
  const app = yield* Application;

  yield* registerMcpTool({
    tool: ExecuteTransaction,
    requiredScope: "mcp:execute",
    hints: executionHints,
    errorMessage: "The transaction could not be executed.",
    handle: ({ request }, principal) =>
      app.execution
        .execute({ actor: principal, idempotencyKey: crypto.randomUUID(), request })
        .pipe(Effect.map((execution) => ({ execution }))),
  });

  yield* registerMcpTool({
    tool: GetExecutionSubmission,
    requiredScope: "mcp:read",
    hints: readOnlyHints,
    errorMessage: "The execution submission could not be found.",
    handle: ({ submissionId }, principal) =>
      app.execution
        .getSubmission({
          organizationId: principal.organizationId,
          actorId: principal.actorId,
          submissionId,
        })
        .pipe(Effect.map((submission) => ({ submission }))),
  });

  yield* registerMcpTool({
    tool: GetExecution,
    requiredScope: "mcp:read",
    hints: readOnlyHints,
    errorMessage: "The execution could not be found.",
    handle: ({ executionId }, principal) =>
      app.execution
        .get({
          organizationId: principal.organizationId,
          actorId: principal.actorId,
          executionId,
        })
        .pipe(Effect.map((execution) => ({ execution }))),
  });

  yield* registerMcpTool({
    tool: ListExecutions,
    requiredScope: "mcp:read",
    hints: readOnlyHints,
    errorMessage: "The executions could not be listed.",
    handle: ({ cursor }, principal) =>
      app.execution.list({
        organizationId: principal.organizationId,
        actorId: principal.actorId,
        ...(cursor === undefined ? {} : { cursor }),
      }),
  });
});
