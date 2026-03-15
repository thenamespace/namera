import { Layer } from "effect";
import { McpServer } from "effect/unstable/ai";

import { BaseTools, BaseToolsHandlers } from "./tools";

export const McpLive = McpServer.toolkit(BaseTools).pipe(
  Layer.provideMerge(BaseToolsHandlers),
);
