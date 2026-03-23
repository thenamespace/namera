import { Effect } from "effect";
import { Toolkit } from "effect/unstable/ai";

import {
  NativeTransferTool,
  nativeTransferToolHandler,
} from "./native-transfer";

export const TransferTools = Toolkit.make(NativeTransferTool);
export const TransferToolsHandlers = TransferTools.toLayer(
  Effect.succeed({
    native_transfer: (params) => nativeTransferToolHandler(params),
  }),
);
