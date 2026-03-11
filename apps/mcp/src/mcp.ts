import { McpServer } from "@effect/ai";
import { Layer } from "effect";

import { BaseTools, BaseToolsHandlers } from "./tools";

export const McpLive = McpServer.toolkit(BaseTools).pipe(
  Layer.provideMerge(BaseToolsHandlers),
);
