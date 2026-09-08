import { Context, Effect, Metric, Schema } from "effect";
import { McpSchema, McpServer, Tool } from "effect/unstable/ai";

import {
  CompleteExecutionResponse,
  GetExecutionSubmissionResponse,
  GetSessionKeyResponse,
  GetWalletResponse,
  ListExecutionsResponse,
  ListSessionKeysForOrganizationResponse,
  ListWalletsResponse,
  McpExecuteTransactionRequest,
  McpGetExecutionsRequest,
  McpGetSessionKeyRequest,
  McpGetTransactionStatusRequest,
  McpGetWalletRequest,
  McpListSessionKeysRequest,
  McpSignRequest,
  McpSimulateTransactionRequest,
  McpVerifySignatureRequest,
  SignResponse,
  SimulateExecutionResponse,
  VerifySignatureResponse,
} from "@namera-ai/protocol/dto";
import type { NameraClient } from "@namera-ai/sdk";
import { mcpToolCalls } from "@namera-ai/telemetry";

import { CurrentLocalMcpPrincipal } from "./api-client.js";
import { localToolError, toolErrorResult, unwrapMcpSdk } from "./tool-errors.js";

const rootObject = (schema: ReturnType<typeof Tool.getJsonSchema>) => {
  const ref = Reflect.get(schema, "$ref");
  const defs = Reflect.get(schema, "$defs");
  if (
    typeof ref !== "string" ||
    !ref.startsWith("#/$defs/") ||
    typeof defs !== "object" ||
    defs === null
  )
    return schema;
  const root = Reflect.get(defs, ref.slice(8));
  return typeof root === "object" && root !== null ? { ...root, $defs: defs } : schema;
};

const register = Effect.fn("LocalMcp.registerTool")(function* <T extends Tool.Any, E>(
  tool: T,
  scope: "mcp:read" | "mcp:execute",
  destructive: boolean,
  handle: (input: Tool.Parameters<T>, client: NameraClient) => Effect.Effect<Tool.Success<T>, E>,
) {
  yield* (yield* McpServer.McpServer).addTool({
    tool: new McpSchema.Tool({
      name: tool.name,
      description: tool.description,
      inputSchema: rootObject(Tool.getJsonSchema(tool)),
      outputSchema: rootObject(Tool.getJsonSchemaFromSchema(tool.successSchema)),
      annotations: {
        readOnlyHint: scope === "mcp:read" || tool.name === "simulate_transaction",
        destructiveHint: destructive,
        idempotentHint: tool.name !== "execute_transaction" && tool.name !== "sign",
        openWorldHint: true,
      },
    }),
    annotations: Context.empty(),
    handle: (payload) =>
      Effect.gen(function* () {
        const principal = yield* CurrentLocalMcpPrincipal;
        if (!principal) return toolErrorResult(localToolError("UNAUTHORIZED"));
        if (!principal.scopes.includes(scope))
          return toolErrorResult(localToolError("INSUFFICIENT_SCOPE"));
        const input = yield* Schema.decodeUnknownEffect(
          tool.parametersSchema as Schema.Codec<Tool.Parameters<T>, unknown, never, never>,
        )(payload);
        const value = yield* handle(input, principal.client);
        const encoded = yield* Schema.encodeUnknownEffect(
          tool.successSchema as Schema.Codec<Tool.Success<T>, unknown, never, never>,
        )(value);
        return new McpSchema.CallToolResult({
          structuredContent: encoded,
          content: [{ type: "text", text: JSON.stringify(encoded) }],
        });
      }).pipe(
        Effect.catch((error) => Effect.succeed(toolErrorResult(error))),
        Effect.tap((result) =>
          Metric.update(
            Metric.withAttributes(mcpToolCalls, {
              tool: tool.name,
              result: result.isError ? "error" : "success",
            }),
            1,
          ),
        ),
        Effect.withSpan("cli.mcp.tool", { attributes: { tool: tool.name } }),
      ),
  });
});

export const localMcpTools = Effect.gen(function* () {
  yield* register(
    Tool.make("list_wallets", {
      description:
        "List delegated wallets. Use a returned wallet id as walletId, never an address or session-key ID.",
      success: Schema.Struct({ wallets: ListWalletsResponse }),
    }),
    "mcp:read",
    false,
    (_, client) =>
      unwrapMcpSdk(() => client.wallets.list()).pipe(Effect.map((wallets) => ({ wallets }))),
  );
  yield* register(
    Tool.make("get_wallet", {
      description: "Get one delegated wallet by walletId from list_wallets.",
      parameters: McpGetWalletRequest,
      success: Schema.Struct({ wallet: GetWalletResponse }),
    }),
    "mcp:read",
    false,
    ({ walletId }, client) =>
      unwrapMcpSdk(() => client.wallets.get(walletId)).pipe(Effect.map((wallet) => ({ wallet }))),
  );
  yield* register(
    Tool.make("list_session_keys", {
      description:
        "List delegated session keys and their wallet IDs. Execute and sign require both walletId and sessionKeyId; do not interchange them. The local key must also be imported on this machine.",
      parameters: McpListSessionKeysRequest,
      success: Schema.Struct({ sessionKeys: ListSessionKeysForOrganizationResponse }),
    }),
    "mcp:read",
    false,
    (input, client) =>
      unwrapMcpSdk(() => client.sessionKeys.list(input)).pipe(
        Effect.map((sessionKeys) => ({ sessionKeys })),
      ),
  );
  yield* register(
    Tool.make("get_session_key", {
      description: "Get one delegated session key and its policies by sessionKeyId.",
      parameters: McpGetSessionKeyRequest,
      success: Schema.Struct({ sessionKey: GetSessionKeyResponse }),
    }),
    "mcp:read",
    false,
    ({ sessionKeyId }, client) =>
      unwrapMcpSdk(() => client.sessionKeys.get(sessionKeyId)).pipe(
        Effect.map((sessionKey) => ({ sessionKey })),
      ),
  );
  yield* register(
    Tool.make("simulate_transaction", {
      description:
        "Simulate the exact session and calls without signing or consuming operation usage. Execute only when allowed and callsSucceeded are true.",
      parameters: McpSimulateTransactionRequest,
      success: Schema.Struct({ simulation: SimulateExecutionResponse }),
    }),
    "mcp:execute",
    false,
    (input, client) =>
      unwrapMcpSdk(() => client.executions.simulate(input)).pipe(
        Effect.map((simulation) => ({ simulation })),
      ),
  );
  yield* register(
    Tool.make("execute_transaction", {
      description:
        "Execute exact calls using walletId and sessionKeyId from discovery tools. Simulate first. Signs locally using an imported session key. Gas is sponsored by default; sponsor:false requires a fee cap configured by the user when starting local MCP. Prepared means queued, not confirmed: poll get_transaction_status. Repeating this tool can transfer assets twice.",
      parameters: McpExecuteTransactionRequest,
      success: Schema.Struct({ execution: CompleteExecutionResponse }),
    }),
    "mcp:execute",
    true,
    (input, client) =>
      unwrapMcpSdk(() => client.executions.execute(input)).pipe(
        Effect.map((execution) => ({ execution })),
      ),
  );
  yield* register(
    Tool.make("get_transaction_status", {
      description:
        "Poll the submissionId returned by execute_transaction until confirmed or failed. Prepared and submitted are still pending.",
      parameters: McpGetTransactionStatusRequest,
      success: Schema.Struct({ submission: GetExecutionSubmissionResponse }),
    }),
    "mcp:read",
    false,
    ({ submissionId }, client) =>
      unwrapMcpSdk(() => client.executions.getStatus(submissionId)).pipe(
        Effect.map((submission) => ({ submission })),
      ),
  );
  yield* register(
    Tool.make("get_executions", {
      description:
        "Read confirmed execution history for this authorization. Pass nextCursor to fetch the next page. Pending submissions use get_transaction_status.",
      parameters: McpGetExecutionsRequest,
      success: ListExecutionsResponse,
    }),
    "mcp:read",
    false,
    (input, client) => unwrapMcpSdk(() => client.executions.list(input)),
  );
  yield* register(
    Tool.make("sign", {
      description:
        "Sign an exact UTF-8 message or EIP-712 object locally, using an explicit walletId and sessionKeyId. Requires imported signature consent and installed onchain signature permission plus passing API policies. Does not submit a transaction.",
      parameters: McpSignRequest,
      success: Schema.Struct({ signature: SignResponse }),
    }),
    "mcp:execute",
    false,
    ({ request }, client) =>
      unwrapMcpSdk(() => client.sign(request)).pipe(Effect.map((signature) => ({ signature }))),
  );
  yield* register(
    Tool.make("verify_signature", {
      description:
        "Verify a smart-account signature against the original unmodified payload and walletId. A false validity result is not a tool failure.",
      parameters: McpVerifySignatureRequest,
      success: Schema.Struct({ verification: VerifySignatureResponse }),
    }),
    "mcp:read",
    false,
    ({ request }, client) =>
      unwrapMcpSdk(() => client.verifySignature(request)).pipe(
        Effect.map((verification) => ({ verification })),
      ),
  );
});
