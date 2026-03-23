import { Layer } from "effect";
import { McpServer } from "effect/unstable/ai";

import { AccountTools, AccountToolsHandlers } from "./tools/account";

const Account = Layer.effectDiscard(
  McpServer.registerToolkit(AccountTools),
).pipe(Layer.provideMerge(AccountToolsHandlers));

export const McpLive = Layer.mergeAll(Account);
