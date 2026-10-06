import { Effect, Predicate, Schema } from "effect";
import { McpSchema } from "effect/ai";

import { McpToolError, McpToolErrorCode } from "@namera-ai/protocol/dto";
import type { NameraResult } from "@namera-ai/sdk";

import { errorFeedback } from "../error-feedback.js";

const messages: Readonly<Record<McpToolErrorCode, string>> = {
  NETWORK_PAUSED: "New operations on this network are paused. Do not retry until it is re-enabled.",
  INVALID_ARGUMENT: "Invalid tool input. Use returned IDs and the documented field formats.",
  UNAUTHORIZED: "The authorization expired or was revoked. Reconnect Namera.",
  INSUFFICIENT_SCOPE: "Reauthorize Namera with permission to execute and sign.",
  WALLET_NOT_FOUND: "Wallet not delegated or not found. Use a walletId from list_wallets.",
  SESSION_KEY_NOT_FOUND: "Session not delegated or not found. Use list_session_keys.",
  EXECUTION_SUBMISSION_NOT_FOUND: "Use the submissionId returned by execute_transaction.",
  NO_AUTHORIZED_SESSION_KEY: "The selected session does not authorize this wallet operation.",
  POLICY_DENIED:
    "The selected session's policy denied the operation. Inspect policyCode and simulate again.",
  IDEMPOTENCY_CONFLICT: "The operation conflicts with an earlier request.",
  EXECUTION_FAILED: "The execution failed. Inspect its status before submitting another operation.",
  EXECUTION_UNAVAILABLE:
    "Execution is unavailable. Check submission status before retrying a transfer.",
  SIGNING_FAILED: "The signature could not be created.",
  SIGNATURE_UNAVAILABLE: "Signature creation is unavailable.",
  VERIFICATION_FAILED: "Signature verification could not be completed on this chain.",
  LIMIT_EXCEEDED: "The workspace has reached its plan limit.",
  RATE_LIMITED: "Too many requests. Wait before retrying.",
  INTERNAL_ERROR: "Namera could not complete the operation.",
  UPSTREAM_UNAVAILABLE:
    "The API is unavailable. Check transaction status before repeating a transfer.",
  LOCAL_SIGNER_REQUIRED: "Configure a local signer before executing or signing.",
  LOCAL_SIGNER_UNAVAILABLE:
    "The authorized session's local key is unavailable. Import it with namera session-key import.",
  PREPARED_EXECUTION_INVALID:
    "The preparation does not match local session authorization or fee consent. Do not sign it.",
  PREPARED_SIGNATURE_INVALID:
    "The challenge does not match the original payload or local signature consent. Do not sign it.",
  LOCAL_SIGNATURE_INVALID: "Local signature verification failed. Check the imported session key.",
};

export const localToolError = (code: McpToolErrorCode): McpToolError => ({
  code,
  message: messages[code],
  retryable: false,
});

export const unwrapMcpSdk = Effect.fn("LocalMcp.unwrapSdk")(function* <A, E>(
  call: () => Promise<NameraResult<A, E>>,
) {
  const result = yield* Effect.tryPromise({
    try: call,
    catch: () => localToolError("INTERNAL_ERROR"),
  });
  if (result.success) return result.data;
  const error = result.error;
  const code =
    error.kind === "contract"
      ? "INVALID_ARGUMENT"
      : error.kind === "network"
        ? "UPSTREAM_UNAVAILABLE"
        : error.status === 401 || (error.kind === "api" && error.tag === "Unauthorized")
          ? "UNAUTHORIZED"
          : error.status === 403 || (error.kind === "api" && error.tag === "Forbidden")
            ? "INSUFFICIENT_SCOPE"
            : "code" in error && Schema.is(McpToolErrorCode)(error.code)
              ? error.code
              : error.status === 429
                ? "RATE_LIMITED"
                : "INTERNAL_ERROR";
  const cause = error.cause;
  const base = localToolError(code);
  // Only schema-validated policy diagnostics can leave the local process.
  const diagnostic = Predicate.isObject(cause)
    ? {
        ...base,
        ...(Reflect.get(cause, "policyId") === undefined
          ? {}
          : { policyId: Reflect.get(cause, "policyId") }),
        ...(Reflect.get(cause, "policyCode") === undefined
          ? {}
          : { policyCode: Reflect.get(cause, "policyCode") }),
      }
    : base;
  return yield* Effect.fail(Schema.is(McpToolError)(diagnostic) ? diagnostic : base);
});

export const toolErrorResult = (failure: unknown) => {
  const error = Schema.is(McpToolError)(failure)
    ? failure
    : localToolError(Schema.isSchemaError(failure) ? "INVALID_ARGUMENT" : "INTERNAL_ERROR");
  const actionable = { ...error, nextStep: errorFeedback(error).nextStep };
  return new McpSchema.CallToolResult({
    isError: true,
    structuredContent: { error: actionable },
    content: [{ type: "text", text: JSON.stringify({ error: actionable }) }],
  });
};
