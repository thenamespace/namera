import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";

import { Application } from "@namera-ai/application";
import {
  GetSessionKeyResponse,
  ListSessionKeysForOrganizationResponse,
  McpGetSessionKeyRequest,
  McpListSessionKeysRequest,
  McpToolError,
} from "@namera-ai/protocol/dto";

import { toSessionKeyResponse } from "#/helpers/index";

import { readOnlyHints, registerMcpTool } from "./register.js";

const ListSessionKeys = Tool.make("list_session_keys", {
  description:
    "List active session keys delegated to this authorization, including their wallet and policies. Optionally filter by walletId. Session keys describe authorization but are not transaction senders: execute_transaction and sign always take walletId and select an eligible session key automatically.",
  parameters: McpListSessionKeysRequest,
  success: Schema.Struct({
    sessionKeys: Schema.optionalKey(ListSessionKeysForOrganizationResponse),
    error: Schema.optionalKey(McpToolError),
  }),
});

const GetSessionKey = Tool.make("get_session_key", {
  description:
    "Get one delegated session key and its immutable policies by sessionKeyId. Use an ID returned by list_session_keys. Do not pass this ID as walletId to transaction or signature tools.",
  parameters: McpGetSessionKeyRequest,
  success: Schema.Struct({
    sessionKey: Schema.optionalKey(GetSessionKeyResponse),
    error: Schema.optionalKey(McpToolError),
  }),
});

export const SessionKeyTools = Effect.gen(function* () {
  const app = yield* Application;

  yield* registerMcpTool({
    tool: ListSessionKeys,
    title: "List session keys",
    requiredScope: "mcp:read",
    hints: readOnlyHints,
    handle: ({ walletId }, principal) =>
      (walletId === undefined
        ? app.sessionKey.listForOrganization({
            organizationId: principal.organizationId,
            actorId: principal.actorId,
          })
        : app.sessionKey.listForWallet({
            organizationId: principal.organizationId,
            actorId: principal.actorId,
            walletId,
          })
      ).pipe(Effect.map((items) => ({ sessionKeys: items.map(toSessionKeyResponse) }))),
  });

  yield* registerMcpTool({
    tool: GetSessionKey,
    title: "Get session key",
    requiredScope: "mcp:read",
    hints: readOnlyHints,
    handle: ({ sessionKeyId }, principal) =>
      app.sessionKey
        .get({
          organizationId: principal.organizationId,
          actorId: principal.actorId,
          sessionKeyId,
        })
        .pipe(Effect.map((sessionKey) => ({ sessionKey: toSessionKeyResponse(sessionKey) }))),
  });
});
