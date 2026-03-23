import { createServer } from "node:http";

import { NodeHttpServer } from "@effect/platform-node";
import { Layer } from "effect";
import { McpServer } from "effect/unstable/ai";
import { HttpRouter } from "effect/unstable/http";

import { McpLive } from "./mcp";

const McpRouter = McpLive.pipe(
  Layer.provideMerge(
    McpServer.layerHttp({
      name: "Namera MCP Server",
      path: "/mcp",
      version: "0.0.1",
    }),
  ),
  Layer.provideMerge(
    HttpRouter.cors({
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "mcp-session-id",
        "mcp-protocol-version",
      ],
      allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedOrigins: ["*"],
      credentials: false,
      exposedHeaders: ["mcp-session-id", "mcp-protocol-version"],
    }),
  ),
);

export const startMcpHttpServer = (port: number) =>
  Layer.launch(
    HttpRouter.serve(McpRouter).pipe(
      Layer.provideMerge(NodeHttpServer.layer(createServer, { port })),
    ),
  );
