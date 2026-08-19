import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";

import { Application } from "@namera-ai/application";
import {
  GetWalletResponse,
  ListWalletsResponse,
  McpGetWalletRequest,
  McpToolError,
} from "@namera-ai/protocol/dto";

import { toWalletResponse } from "#/helpers/index";

import { readOnlyHints, registerMcpTool } from "./register.js";

const ListWallets = Tool.make("list_wallets", {
  description:
    "List the Namera wallets delegated to this authorization. Call this before transaction or signature tools when you do not already have a walletId. Use the returned wallet id as walletId; never use the wallet address or a session-key id in its place.",
  success: Schema.Struct({
    wallets: Schema.optionalKey(ListWalletsResponse),
    error: Schema.optionalKey(McpToolError),
  }),
});

const GetWallet = Tool.make("get_wallet", {
  description:
    "Get one delegated Namera wallet by its walletId. Use a walletId returned by list_wallets. Do not pass a wallet address or session-key ID.",
  parameters: McpGetWalletRequest,
  success: Schema.Struct({
    wallet: Schema.optionalKey(GetWalletResponse),
    error: Schema.optionalKey(McpToolError),
  }),
});

export const WalletTools = Effect.gen(function* () {
  const app = yield* Application;

  yield* registerMcpTool({
    tool: ListWallets,
    title: "List wallets",
    requiredScope: "mcp:read",
    hints: readOnlyHints,
    handle: (_input, principal) =>
      app.wallet
        .list({
          organizationId: principal.organizationId,
          actorId: principal.actorId,
        })
        .pipe(Effect.map((items) => ({ wallets: items.map(toWalletResponse) }))),
  });

  yield* registerMcpTool({
    tool: GetWallet,
    title: "Get wallet",
    requiredScope: "mcp:read",
    hints: readOnlyHints,
    handle: ({ walletId }, principal) =>
      app.wallet
        .get({
          organizationId: principal.organizationId,
          actorId: principal.actorId,
          walletId,
        })
        .pipe(Effect.map((wallet) => ({ wallet: toWalletResponse(wallet) }))),
  });
});
