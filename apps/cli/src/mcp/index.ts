import { createServer } from "node:http";

import { NodeHttpServer, NodeStdio } from "@effect/platform-node";
import { Layer, Logger } from "effect";
import { McpServer } from "effect/unstable/ai";
import { HttpRouter } from "effect/unstable/http";

import { McpLive } from "./mcp";

const MCP_SERVER_NAME = "Namera MCP Server";
const MCP_SERVER_VERSION = "0.0.1";

const McpRouter = McpLive.pipe(
  Layer.provideMerge(
    McpServer.layerHttp({
      name: MCP_SERVER_NAME,
      path: "/mcp",
      version: MCP_SERVER_VERSION,
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

const McpStdio = McpLive.pipe(
  Layer.provideMerge(
    McpServer.layerStdio({
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    }),
  ),
  Layer.provide(NodeStdio.layer),
  Layer.provide(Layer.succeed(Logger.LogToStderr)(true)),
);

export const startMcpHttpServer = (port: number) =>
  Layer.launch(
    HttpRouter.serve(McpRouter).pipe(
      Layer.provideMerge(NodeHttpServer.layer(createServer, { port })),
    ),
  );

export const startMcpStdioServer = () => Layer.launch(McpStdio);
