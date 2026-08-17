import { Effect, Layer } from "effect";
import { McpProtocol, McpServer } from "effect/unstable/ai";

import { AuthConfig } from "@namera-ai/application";

import { ExecutionTools, SessionKeyTools, SignatureTools, WalletTools } from "./tools/index.js";

const McpTools = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* WalletTools;
    yield* SessionKeyTools;
    yield* ExecutionTools;
    yield* SignatureTools;
  }),
);

const McpTransport = Layer.unwrap(
  Effect.map(AuthConfig, (config) =>
    McpServer.layerHttp({
      name: "Namera",
      version: "0.1.0",
      path: "/mcp",
      protocols: [McpProtocol.v2025_06_18],
      allowedOrigins: [config.dashboardPublicOrigin.toString().replace(/\/$/, "")],
    }),
  ),
);

export const McpRoutes = McpTools.pipe(Layer.provide(McpTransport));
