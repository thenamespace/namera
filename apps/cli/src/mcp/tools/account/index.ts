import { Effect } from "effect";
import { Toolkit } from "effect/unstable/ai";

import { GetAddressTool, getAddressToolHandler } from "./address";

export const AccountTools = Toolkit.make(GetAddressTool);
export const AccountToolsHandlers = AccountTools.toLayer(
  Effect.succeed({
    get_wallet_address: getAddressToolHandler,
  }),
);
