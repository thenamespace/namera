import { createServer } from "node:http";

import { NodeHttpServer, NodeStdio } from "@effect/platform-node";
import { Effect, Layer, Logger } from "effect";
import { McpServer } from "effect/unstable/ai";
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

import { McpLive } from "./mcp";

const MCP_SERVER_NAME = "Namera MCP Server";
const MCP_SERVER_VERSION = "0.0.1";

const methodNotAllowed = HttpServerResponse.empty({
  headers: { allow: "POST, OPTIONS" },
  status: 405,
});

const McpRouter = McpLive.pipe(
  Layer.provideMerge(HttpRouter.add("GET", "/mcp", methodNotAllowed)),
  Layer.provideMerge(
    McpServer.layerHttp({
      name: MCP_SERVER_NAME,
      path: "/mcp",
      version: MCP_SERVER_VERSION,
    }),
  ),
  Layer.provideMerge(
    HttpRouter.middleware(
      (httpEffect) =>
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const response = yield* httpEffect;
          const isMcpEndpoint = request.url.split("?")[0] === "/mcp";

          const body = response.body as {
            _tag: string;
            contentLength?: number;
          };

          if (
            request.method === "POST" &&
            isMcpEndpoint &&
            response.status === 200 &&
            (body._tag === "Empty" ||
              body._tag === "Stream" ||
              body.contentLength === 0)
          ) {
            const { "content-type": _contentType, ...headers } =
              response.headers;

            return HttpServerResponse.empty({
              headers,
              status: 202,
            });
          }

          return response;
        }),
      { global: true },
    ),
  ),
  Layer.provideMerge(
    HttpRouter.cors({
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "mcp-protocol-version",
        "mcp-session-id",
      ],
      allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedOrigins: ["*"],
      credentials: false,
      exposedHeaders: ["mcp-session-id"],
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
