import { Effect } from "effect";
import { Toolkit } from "effect/unstable/ai";

import { NativeTransferTool, nativeTransferHandler } from "./native-transfer";

export const TransferTools = Toolkit.make(NativeTransferTool);
export const TransferToolsHandlers = TransferTools.toLayer(
  Effect.succeed({
    native_transfer: nativeTransferHandler,
  }),
);
