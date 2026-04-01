import { Layer } from "effect";
import { McpServer } from "effect/unstable/ai";

import { AccountTools, AccountToolsHandlers } from "./tools/account";
import { ReadTools, ReadToolsHandlers } from "./tools/read";
import {
  TransactionTools,
  TransactionToolsHandlers,
} from "./tools/transaction";

const Account = Layer.effectDiscard(
  McpServer.registerToolkit(AccountTools),
).pipe(Layer.provideMerge(AccountToolsHandlers));

const Transfer = Layer.effectDiscard(
  McpServer.registerToolkit(TransactionTools),
).pipe(Layer.provideMerge(TransactionToolsHandlers));

const Read = Layer.effectDiscard(McpServer.registerToolkit(ReadTools)).pipe(
  Layer.provideMerge(ReadToolsHandlers),
);

export const McpLive = Layer.mergeAll(Account, Transfer, Read);
