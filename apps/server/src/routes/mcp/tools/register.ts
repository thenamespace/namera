import { Context, Effect, Metric, Predicate, Schema } from "effect";
import { McpSchema, McpServer, Tool } from "effect/unstable/ai";

import type { McpToolError, McpToolErrorCode } from "@namera-ai/protocol/dto";
import type { OAuthScope } from "@namera-ai/protocol/model";
import { mcpToolCalls } from "@namera-ai/telemetry";

import { CurrentMcpPrincipal, type McpPrincipal } from "../principal.js";

type ToolHints = {
  readonly readOnly: boolean;
  readonly destructive: boolean;
  readonly idempotent: boolean;
  readonly openWorld: boolean;
};

// MCP clients commonly require the root tool schema to be an object. Effect's
// JSON Schema encoder emits annotated structs as a root `$ref`, so inline only
// that root while retaining `$defs` for nested reusable schemas.
const inlineRootReference = (schema: ReturnType<typeof Tool.getJsonSchema>) => {
  const reference = Reflect.get(schema, "$ref");
  const definitions = Reflect.get(schema, "$defs");
  if (
    typeof reference !== "string" ||
    !reference.startsWith("#/$defs/") ||
    typeof definitions !== "object" ||
    definitions === null
  ) {
    return schema;
  }

  const definition = Reflect.get(definitions, reference.slice("#/$defs/".length));
  return typeof definition === "object" && definition !== null
    ? { ...definition, $defs: definitions }
    : schema;
};

export const registerMcpTool = <T extends Tool.Any, E>(options: {
  readonly tool: T;
  readonly title: string;
  readonly requiredScope: Extract<OAuthScope, "mcp:read" | "mcp:execute">;
  readonly hints: ToolHints;
  readonly handle: (
    input: Tool.Parameters<T>,
    principal: McpPrincipal,
  ) => Effect.Effect<Tool.Success<T>, E>;
}) =>
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;

    yield* server.addTool({
      tool: new McpSchema.Tool({
        name: options.tool.name,
        description: options.tool.description,
        inputSchema: inlineRootReference(Tool.getJsonSchema(options.tool)),
        outputSchema: inlineRootReference(Tool.getJsonSchemaFromSchema(options.tool.successSchema)),
        annotations: {
          title: options.title,
          readOnlyHint: options.hints.readOnly,
          destructiveHint: options.hints.destructive,
          idempotentHint: options.hints.idempotent,
          openWorldHint: options.hints.openWorld,
        },
      }),
      annotations: Context.empty(),
      handle: (payload) =>
        Effect.gen(function* () {
          const principal = yield* CurrentMcpPrincipal;
          if (principal === null) {
            yield* Metric.update(
              Metric.withAttributes(mcpToolCalls, {
                tool: options.tool.name,
                result: "unauthorized",
              }),
              1,
            );

            return makeToolError({
              code: "UNAUTHORIZED",
              message: "The MCP authorization is unavailable or expired. Reconnect Namera.",
              retryable: false,
            });
          }

          if (!principal.scopes.includes(options.requiredScope)) {
            yield* Metric.update(
              Metric.withAttributes(mcpToolCalls, {
                tool: options.tool.name,
                result: "insufficient_scope",
              }),
              1,
            );

            return makeToolError({
              code: "INSUFFICIENT_SCOPE",
              message: `This tool requires the ${options.requiredScope} OAuth scope. Reauthorize Namera with that scope before retrying.`,
              retryable: false,
            });
          }

          const input = yield* Schema.decodeUnknownEffect(
            options.tool.parametersSchema as Schema.Codec<
              Tool.Parameters<T>,
              unknown,
              never,
              never
            >,
          )(payload);
          const result = yield* options.handle(input, principal);
          const encoded = yield* Schema.encodeUnknownEffect(
            options.tool.successSchema as Schema.Codec<Tool.Success<T>, unknown, never, never>,
          )(result);

          yield* Metric.update(
            Metric.withAttributes(mcpToolCalls, {
              tool: options.tool.name,
              result: "success",
            }),
            1,
          );

          return new McpSchema.CallToolResult({
            structuredContent: encoded,
            content: [{ type: "text", text: JSON.stringify(encoded) }],
          });
        }).pipe(
          Effect.catch((error) =>
            Metric.update(
              Metric.withAttributes(mcpToolCalls, {
                tool: options.tool.name,
                result: "error",
              }),
              1,
            ).pipe(Effect.as(makeToolError(toToolError(error)))),
          ),
        ),
    });
  });

export const readOnlyHints = {
  readOnly: true,
  destructive: false,
  idempotent: true,
  openWorld: false,
} as const;

export const executionHints = {
  readOnly: false,
  destructive: true,
  idempotent: false,
  openWorld: true,
} as const;

export const simulationHints = {
  readOnly: true,
  destructive: false,
  idempotent: true,
  openWorld: true,
} as const;

export const verificationHints = {
  readOnly: true,
  destructive: false,
  idempotent: true,
  openWorld: true,
} as const;

export const signingHints = {
  readOnly: false,
  destructive: false,
  idempotent: false,
  openWorld: false,
} as const;

const errorMessages: Readonly<Record<McpToolErrorCode, string>> = {
  INVALID_ARGUMENT:
    "The tool arguments are invalid. Use IDs returned by Namera tools and follow the documented field formats.",
  UNAUTHORIZED: "The MCP authorization is unavailable or expired. Reconnect Namera.",
  INSUFFICIENT_SCOPE: "The MCP authorization does not include the scope required by this tool.",
  WALLET_NOT_FOUND:
    "The wallet was not found or is not delegated to this authorization. Call list_wallets and use a returned wallet ID.",
  SESSION_KEY_NOT_FOUND:
    "The session key was not found or is not delegated to this authorization. Call list_session_keys and use a returned session-key ID.",
  EXECUTION_SUBMISSION_NOT_FOUND:
    "The transaction submission was not found. Use the submissionId returned by execute_transaction.",
  NO_AUTHORIZED_SESSION_KEY:
    "No delegated session key can authorize this operation for the selected wallet.",
  POLICY_DENIED:
    "Every eligible session key was denied by policy. Inspect policyCode, adjust the operation, and simulate it again.",
  IDEMPOTENCY_CONFLICT: "The operation conflicts with an earlier request and was not repeated.",
  EXECUTION_FAILED: "The transaction could not be prepared, signed, or submitted.",
  EXECUTION_UNAVAILABLE:
    "Transaction execution is temporarily unavailable. Retry later or simulate the operation again.",
  SIGNING_FAILED: "The wallet could not sign the requested payload.",
  SIGNATURE_UNAVAILABLE: "Signature creation is temporarily unavailable.",
  VERIFICATION_FAILED: "The smart-account signature could not be verified on the selected chain.",
  LIMIT_EXCEEDED: "The organization has reached the applicable plan limit.",
  RATE_LIMITED: "Too many requests were made. Wait for retryAfterSeconds before retrying.",
  INTERNAL_ERROR: "Namera could not complete the tool call because of an internal error.",
};

const knownErrorCodes = new Set<McpToolErrorCode>(Object.keys(errorMessages) as McpToolErrorCode[]);

const readString = (value: unknown, key: string): string | undefined => {
  if (!Predicate.isObject(value)) return undefined;
  const field = Reflect.get(value, key);
  return typeof field === "string" ? field : undefined;
};

const readNumber = (value: unknown, key: string): number | undefined => {
  if (!Predicate.isObject(value)) return undefined;
  const field = Reflect.get(value, key);
  return typeof field === "number" ? field : undefined;
};

const toToolError = (error: unknown): McpToolError => {
  if (Schema.isSchemaError(error)) {
    return {
      code: "INVALID_ARGUMENT",
      message: errorMessages.INVALID_ARGUMENT,
      retryable: false,
    };
  }

  const tag = readString(error, "_tag");
  const rawCode = readString(error, "code");
  const code =
    tag === "RateLimitExceeded"
      ? "RATE_LIMITED"
      : rawCode !== undefined && knownErrorCodes.has(rawCode as McpToolErrorCode)
        ? (rawCode as McpToolErrorCode)
        : "INTERNAL_ERROR";
  const policyId = readString(error, "policyId");
  const policyCode = readString(error, "policyCode");
  const retryAfterSeconds = readNumber(error, "retryAfterSeconds");

  return {
    code,
    message: errorMessages[code],
    retryable: code === "RATE_LIMITED" || code === "EXECUTION_UNAVAILABLE",
    ...(policyId === undefined
      ? {}
      : { policyId: policyId as NonNullable<McpToolError["policyId"]> }),
    ...(policyCode === undefined
      ? {}
      : { policyCode: policyCode as NonNullable<McpToolError["policyCode"]> }),
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  };
};

const makeToolError = (error: McpToolError) => {
  const structuredContent = { error };

  return new McpSchema.CallToolResult({
    isError: true,
    structuredContent,
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
  });
};
