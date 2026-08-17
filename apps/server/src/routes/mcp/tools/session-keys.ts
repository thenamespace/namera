import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";

import { Application } from "@namera-ai/application";
import {
  GetSessionKeyRequest,
  GetSessionKeyResponse,
  ListMcpSessionKeyGrantsResponse,
  ListSessionKeysForOrganizationResponse,
  ListSessionKeysForWalletRequest,
  ListSessionKeysForWalletResponse,
} from "@namera-ai/protocol/dto";

import { toSessionKeyResponse } from "#/helpers/index";

import { readOnlyHints, registerMcpTool } from "./register.js";

const ListSessionKeyGrants = Tool.make("list_session_key_grants", {
  description:
    "List the active session-key grants and compact session-key details delegated to this MCP authorization.",
  success: ListMcpSessionKeyGrantsResponse,
});

const ListSessionKeys = Tool.make("list_session_keys", {
  description:
    "List the active session keys delegated to this authorization, including wallet and creator details.",
  success: Schema.Struct({ sessionKeys: ListSessionKeysForOrganizationResponse }),
});

const ListSessionKeysForWallet = Tool.make("list_session_keys_for_wallet", {
  description: "List delegated session keys for one wallet.",
  parameters: ListSessionKeysForWalletRequest,
  success: Schema.Struct({ sessionKeys: ListSessionKeysForWalletResponse }),
});

const GetSessionKey = Tool.make("get_session_key", {
  description: "Get one delegated session key by ID.",
  parameters: GetSessionKeyRequest,
  success: Schema.Struct({ sessionKey: GetSessionKeyResponse }),
});

export const SessionKeyTools = Effect.gen(function* () {
  const app = yield* Application;

  yield* registerMcpTool({
    tool: ListSessionKeyGrants,
    requiredScope: "mcp:read",
    hints: readOnlyHints,
    errorMessage: "The session-key grants could not be listed.",
    handle: (_input, principal) =>
      Effect.succeed({
        grants: principal.grants.map(({ grant, sessionKey }) => ({
          id: grant.id,
          organizationId: grant.organizationId,
          actorId: grant.actorId,
          sessionKey: {
            id: sessionKey.id,
            organizationId: sessionKey.organizationId,
            walletId: sessionKey.walletId,
            namespace: sessionKey.namespace,
            metadata: sessionKey.metadata,
            policies: sessionKey.policies,
            policyHash: sessionKey.policyHash,
            status: sessionKey.status,
            revokedAt: sessionKey.revokedAt,
            createdAt: sessionKey.createdAt,
          },
          createdAt: grant.createdAt,
        })),
      }),
  });

  yield* registerMcpTool({
    tool: ListSessionKeys,
    requiredScope: "mcp:read",
    hints: readOnlyHints,
    errorMessage: "The session keys could not be listed.",
    handle: (_input, principal) =>
      app.sessionKey
        .listForOrganization({
          organizationId: principal.organizationId,
          actorId: principal.actorId,
        })
        .pipe(Effect.map((items) => ({ sessionKeys: items.map(toSessionKeyResponse) }))),
  });

  yield* registerMcpTool({
    tool: ListSessionKeysForWallet,
    requiredScope: "mcp:read",
    hints: readOnlyHints,
    errorMessage: "The wallet session keys could not be listed.",
    handle: ({ walletId }, principal) =>
      app.sessionKey
        .listForWallet({
          organizationId: principal.organizationId,
          actorId: principal.actorId,
          walletId,
        })
        .pipe(Effect.map((items) => ({ sessionKeys: items.map(toSessionKeyResponse) }))),
  });

  yield* registerMcpTool({
    tool: GetSessionKey,
    requiredScope: "mcp:read",
    hints: readOnlyHints,
    errorMessage: "The session key could not be found.",
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
