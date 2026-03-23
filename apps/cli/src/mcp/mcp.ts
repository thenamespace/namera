import { Layer } from "effect";
import { McpServer } from "effect/unstable/ai";

import { AccountTools, AccountToolsHandlers } from "./tools/account";
import { TransferTools, TransferToolsHandlers } from "./tools/transfer";

const Account = Layer.effectDiscard(
  McpServer.registerToolkit(AccountTools),
).pipe(Layer.provideMerge(AccountToolsHandlers));

const Transfer = Layer.effectDiscard(
  McpServer.registerToolkit(TransferTools),
).pipe(Layer.provideMerge(TransferToolsHandlers));

export const McpLive = Layer.mergeAll(Account, Transfer);
