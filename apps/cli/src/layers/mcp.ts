import { Effect, Layer, ServiceMap } from "effect";
import type { QuitError } from "effect/Terminal";
import type { ServeError } from "effect/unstable/http/HttpServerError";

import type { StartMcpServerParams } from "@/dto/mcp";
import { startMcpHttpServer, startMcpStdioServer } from "@/mcp";

import type { ConfigManagerError } from "./config";
import { McpContext } from "./mcp-context";
import { SessionKeyManager, type SessionKeyManagerError } from "./session-key";
import { SmartAccountManager } from "./smart-account";

export type McpManager = {
  startMcpServer: (
    params: StartMcpServerParams,
  ) => Effect.Effect<
    void,
    SessionKeyManagerError | ConfigManagerError | QuitError | ServeError
  >;
};

export const McpManager = ServiceMap.Service<McpManager>(
  "@namera-ai/cli/McpManager",
);

export const layer = Layer.effect(
  McpManager,
  Effect.gen(function* () {
    const smartAccountManager = yield* SmartAccountManager;
    const sessionKeyManager = yield* SessionKeyManager;

    const startMcpServer = (params: StartMcpServerParams) =>
      Effect.gen(function* () {
        const sa = yield* smartAccountManager.getSmartAccount({
          alias: params.smartAccountAlias,
        });

        const sessionKeys = Object.entries(params.sessionKeys);

        const sessionKeysWithSigners = yield* Effect.all(
          sessionKeys.map(([alias, password]) =>
            sessionKeyManager.getSessionKeySigner({
              alias,
              password,
            }),
          ),
        );

        const context = McpContext.of({
          smartAccount: sa.data,
          sessionKeys: sessionKeysWithSigners,
        });

        if (params.transport === "stdio") {
          yield* startMcpStdioServer().pipe(
            Effect.provideService(McpContext, context),
          );
        } else {
          yield* startMcpHttpServer(params.port ?? 8080).pipe(
            Effect.provideService(McpContext, context),
          );
        }
      });
    return McpManager.of({ startMcpServer });
  }),
);
