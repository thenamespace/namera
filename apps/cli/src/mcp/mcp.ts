import { Layer } from "effect";
import { McpServer } from "effect/unstable/ai";

import { AccountTools, AccountToolsHandlers } from "./tools/account";

export const McpLive = McpServer.toolkit(AccountTools).pipe(
  Layer.provideMerge(AccountToolsHandlers),
);
