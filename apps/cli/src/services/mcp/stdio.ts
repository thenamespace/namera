import { Layer } from "effect";
import { McpProtocol, McpServer } from "effect/unstable/ai";

import { localMcpTools } from "./tools.js";

export const mcpStdio = Layer.effectDiscard(localMcpTools).pipe(
  Layer.provide(
    McpServer.layerStdio({
      name: "Namera",
      version: "0.1.0",
      protocols: [McpProtocol.v2025_06_18],
    }),
  ),
);
