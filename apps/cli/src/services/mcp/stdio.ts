import { Layer } from "effect";
import { McpProtocol, McpServer } from "effect/ai";

import { version } from "#/version";

import { localMcpTools } from "./tools.js";

export const mcpStdio = Layer.effectDiscard(localMcpTools).pipe(
  Layer.provide(
    McpServer.layerStdio({
      name: "Namera",
      version,
      protocols: [McpProtocol.v2025_06_18],
    }),
  ),
);
