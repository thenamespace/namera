import { createServer } from "node:http";

import { McpServer } from "@effect/ai";
import { HttpApiBuilder, HttpRouter } from "@effect/platform";
import { NodeHttpServer, NodeSink, NodeStream } from "@effect/platform-node";
import { Layer, Logger } from "effect";

import { McpLive } from "./mcp";

export const startStdioServer = () =>
  Layer.launch(
    McpLive.pipe(
      Layer.provideMerge(
        McpServer.layerStdio({
          name: "MCP Server",
          stdin: NodeStream.stdin,
          stdout: NodeSink.stdout,
          version: "0.0.1",
        }),
      ),
      Layer.provide(Logger.add(Logger.prettyLogger({ stderr: true }))),
    ),
  );

const McpRouter = Layer.mergeAll(McpLive, HttpRouter.Default.serve()).pipe(
  Layer.provide(
    McpServer.layerHttp({
      name: "MCP Server",
      path: "/mcp",
      version: "0.0.1",
    }),
  ),
  Layer.provide(
    HttpApiBuilder.middlewareCors({
      allowedHeaders: ["Content-Type", "Authorization", "mcp-protocol-version"],
      allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedOrigins: ["*"],
      credentials: false,
    }),
  ),
);

export const startHttpServer = (port: number) =>
  Layer.launch(
    McpRouter.pipe(Layer.provide(NodeHttpServer.layer(createServer, { port }))),
  );
