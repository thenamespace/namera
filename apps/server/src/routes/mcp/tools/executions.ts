import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";

import { Application } from "@namera-ai/application";
import {
  ExecuteResponse,
  GetExecutionSubmissionResponse,
  ListExecutionsResponse,
  McpGetExecutionsRequest,
  McpGetTransactionStatusRequest,
  McpToolError,
  McpTransactionRequest,
  SimulateExecutionResponse,
} from "@namera-ai/protocol/dto";

import { toExecutionListItemResponse } from "#/helpers/index";

import { executionHints, readOnlyHints, registerMcpTool, simulationHints } from "./register.js";

const ExecuteTransaction = Tool.make("execute_transaction", {
  description:
    "Sign and submit the exact EVM calls from a delegated Namera wallet. Call simulate_transaction first and proceed only when allowed and callsSucceeded are both true. Use walletId from list_wallets, never a wallet address or session-key ID. Namera selects an eligible session key automatically. This operation can transfer assets and repeated tool calls can submit more than one transaction.",
  parameters: McpTransactionRequest,
  success: Schema.Struct({
    execution: Schema.optionalKey(ExecuteResponse),
    error: Schema.optionalKey(McpToolError),
  }),
});

const SimulateTransaction = Tool.make("simulate_transaction", {
  description:
    "Simulate exact EVM calls and evaluate every eligible delegated session key policy without signing, submitting, reserving policy usage, or consuming billing usage. Use walletId from list_wallets, never a wallet address or session-key ID. Execute only when allowed and callsSucceeded are both true.",
  parameters: McpTransactionRequest,
  success: Schema.Struct({
    simulation: Schema.optionalKey(SimulateExecutionResponse),
    error: Schema.optionalKey(McpToolError),
  }),
});

const GetTransactionStatus = Tool.make("get_transaction_status", {
  description:
    "Get the current lifecycle status of a transaction submission. Use the submissionId returned by execute_transaction. A submitted status is still pending; poll this tool until it returns confirmed or failed.",
  parameters: McpGetTransactionStatusRequest,
  success: Schema.Struct({
    submission: Schema.optionalKey(GetExecutionSubmissionResponse),
    error: Schema.optionalKey(McpToolError),
  }),
});

const GetExecutions = Tool.make("get_executions", {
  description:
    "Get confirmed executions created by this authorization, newest first. Omit cursor for the first page; pass the returned nextCursor to fetch the next page. Transaction submissions that are still pending are available through get_transaction_status instead.",
  parameters: McpGetExecutionsRequest,
  success: Schema.Struct({
    items: Schema.optionalKey(ListExecutionsResponse.fields.items),
    nextCursor: Schema.optionalKey(ListExecutionsResponse.fields.nextCursor),
    error: Schema.optionalKey(McpToolError),
  }),
});

export const ExecutionTools = Effect.gen(function* () {
  const app = yield* Application;

  yield* registerMcpTool({
    tool: ExecuteTransaction,
    title: "Execute transaction",
    requiredScope: "mcp:execute",
    hints: executionHints,
    handle: (request, principal) =>
      app.execution
        .execute({ actor: principal, idempotencyKey: crypto.randomUUID(), request })
        .pipe(Effect.map((execution) => ({ execution }))),
  });

  yield* registerMcpTool({
    tool: SimulateTransaction,
    title: "Simulate transaction",
    requiredScope: "mcp:execute",
    hints: simulationHints,
    handle: (request, principal) =>
      app.execution
        .simulate({ actor: principal, request })
        .pipe(Effect.map((simulation) => ({ simulation }))),
  });

  yield* registerMcpTool({
    tool: GetTransactionStatus,
    title: "Get transaction status",
    requiredScope: "mcp:read",
    hints: readOnlyHints,
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
    tool: GetExecutions,
    title: "Get executions",
    requiredScope: "mcp:read",
    hints: readOnlyHints,
    handle: ({ cursor }, principal) =>
      app.execution
        .list({
          organizationId: principal.organizationId,
          actorId: principal.actorId,
          ...(cursor === undefined ? {} : { cursor }),
        })
        .pipe(
          Effect.map((result) => ({
            items: result.items.map(toExecutionListItemResponse),
            nextCursor: result.nextCursor,
          })),
        ),
  });
});
