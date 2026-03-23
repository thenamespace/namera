import { Effect, type Option, Redacted, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { StartMcpServerParams } from "@/dto/mcp";
import { getGlobalFlags } from "@/flags/global";
import { McpManager, SessionKeyManager, SmartAccountManager } from "@/layers";

export const handler = (
  flagSmartAccount: Option.Option<string>,
  flagSessionKeys: Option.Option<Record<string, string>>,
  flagTransport: Option.Option<"stdio" | "http">,
  flagPort: Option.Option<number>,
) =>
  Effect.gen(function* () {
    const smartAccountManager = yield* SmartAccountManager.SmartAccountManager;
    const sessionKeyManager = yield* SessionKeyManager.SessionKeyManager;
    const mcpManager = yield* McpManager.McpManager;
    const globalFlags = yield* getGlobalFlags();

    let params: StartMcpServerParams;

    if (globalFlags.params._tag === "Some") {
      params = Schema.decodeUnknownSync(
        Schema.fromJsonString(StartMcpServerParams),
      )(globalFlags.params.value);
    } else {
      let smartAccountAlias: string;
      let sessionKeys: Record<string, string> = {};
      let transport: "stdio" | "http";
      let port: number;

      if (flagSmartAccount._tag === "Some") {
        smartAccountAlias = flagSmartAccount.value;
      } else {
        smartAccountAlias = (yield* smartAccountManager.selectSmartAccount({
          message: "Select smart account to use for the MCP server",
        })).alias;
      }

      if (flagSessionKeys._tag === "Some") {
        sessionKeys = flagSessionKeys.value;
      } else {
        const keys = yield* sessionKeyManager.multiSelectSessionKeys({
          message: "Select session keys to use for the MCP server",
          smartAccount: smartAccountAlias,
        });

        for (const key of keys) {
          const pass = yield* sessionKeyManager.getSessionKeyPassword({
            alias: key.alias,
            message: `Enter password for session key ${key.alias}:`,
          });
          sessionKeys[key.alias] = Redacted.value(pass);
        }
      }

      if (flagTransport._tag === "Some") {
        transport = flagTransport.value;
      } else {
        transport = "stdio";
      }

      if (flagPort._tag === "Some") {
        port = flagPort.value;
      } else {
        port = 8080;
      }

      params = { smartAccountAlias, sessionKeys, transport, port };
    }

    yield* mcpManager.startMcpServer(params);
  });

const smartAccount = Flag.string("smart-account").pipe(
  Flag.withAlias("sa"),
  Flag.optional,
  Flag.withDescription("The smart account alias to use for the MCP server"),
);

const sessionKeys = Flag.keyValuePair("session-key").pipe(
  Flag.withAlias("sk"),
  Flag.optional,
  Flag.withDescription(
    "The session key aliases, password pairs to use for the MCP server",
  ),
);

const transport = Flag.choice("transport", ["stdio", "http"]).pipe(
  Flag.withAlias("t"),
  Flag.optional,
  Flag.withDescription("The transport to use for the MCP server"),
);

const port = Flag.integer("port").pipe(
  Flag.withAlias("p"),
  Flag.optional,
  Flag.withDescription(
    "The port to use for the MCP server when using http transport",
  ),
);

export const startMcpCommand = Command.make(
  "start",
  { smartAccount, sessionKeys, transport, port },
  ({ smartAccount, sessionKeys, transport, port }) =>
    handler(smartAccount, sessionKeys, transport, port),
).pipe(
  Command.withAlias("s"),
  Command.withDescription("Starts the local MCP server."),
  Command.withExamples([
    {
      command:
        "namera mcp start --smart-account my-smart --session-key my-key=my-password",
      description:
        "Starts the local MCP server with a single session key and the default transport",
    },
    {
      command:
        "namera mcp start --smart-account my-smart --session-key my-key=my-password --transport http --port 8080",
      description:
        "Starts the local MCP server with a single session key and http transport on port 8080",
    },
    {
      command:
        "namera mcp start --smart-account my-smart --session-key my-key=my-password --session-key my-other-key=my-other-password",
      description:
        "Starts the local MCP server with multiple session keys and the default transport",
    },
    {
      command: "namera schema mcp.start",
      description: "Get the schema for the start command",
    },
  ]),
);
