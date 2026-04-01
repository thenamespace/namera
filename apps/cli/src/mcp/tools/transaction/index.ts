import { Effect } from "effect";
import { Toolkit } from "effect/unstable/ai";

import {
  ExecuteTransactionTool,
  executeTransactionToolHandler,
} from "./execute-transaction";
import {
  NativeTransferTool,
  nativeTransferToolHandler,
} from "./native-transfer";

export const TransactionTools = Toolkit.make(
  NativeTransferTool,
  ExecuteTransactionTool,
);
export const TransactionToolsHandlers = TransactionTools.toLayer(
  Effect.succeed({
    native_transfer: (params) => nativeTransferToolHandler(params),
    execute_transaction: (params) => executeTransactionToolHandler(params),
  }),
);
