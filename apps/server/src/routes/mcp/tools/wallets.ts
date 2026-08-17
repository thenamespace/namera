import { Effect } from "effect";
import { Tool } from "effect/unstable/ai";

import { Application } from "@namera-ai/application";
import { GetWalletRequest, GetWalletResponse, ListWalletsResponse } from "@namera-ai/protocol/dto";

import { toWalletResponse } from "#/helpers/index";

import { readOnlyHints, registerMcpTool } from "./register.js";

const ListWallets = Tool.make("list_wallets", {
  description: "List wallets reachable through this authorization's active session-key grants.",
  success: ListWalletsResponse,
});

const GetWallet = Tool.make("get_wallet", {
  description: "Get one wallet reachable through this authorization by wallet ID.",
  parameters: GetWalletRequest,
  success: GetWalletResponse,
});

export const WalletTools = Effect.gen(function* () {
  const app = yield* Application;

  yield* registerMcpTool({
    tool: ListWallets,
    requiredScope: "mcp:read",
    hints: readOnlyHints,
    errorMessage: "The wallets could not be listed.",
    handle: (_input, principal) =>
      app.wallet
        .list({
          organizationId: principal.organizationId,
          actorId: principal.actorId,
        })
        .pipe(Effect.map((items) => items.map(toWalletResponse))),
  });

  yield* registerMcpTool({
    tool: GetWallet,
    requiredScope: "mcp:read",
    hints: readOnlyHints,
    errorMessage: "The wallet could not be found.",
    handle: ({ walletId }, principal) =>
      app.wallet
        .get({
          organizationId: principal.organizationId,
          actorId: principal.actorId,
          walletId,
        })
        .pipe(Effect.map(toWalletResponse)),
  });
});
