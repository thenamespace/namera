import { Effect } from "effect";
import { Toolkit } from "effect/unstable/ai";

import { GetAddressTool, getAddressToolHandler } from "./address";
import { GetBalanceTool, getBalanceToolHandler } from "./get-balance";

export const AccountTools = Toolkit.make(GetAddressTool, GetBalanceTool);
export const AccountToolsHandlers = AccountTools.toLayer(
  Effect.succeed({
    get_wallet_address: getAddressToolHandler,
    get_balance: getBalanceToolHandler,
  }),
);
