import { Effect, type Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import {
  AccountManager,
  CurrentMcpContext,
  type CurrentMcpContextShape,
  SessionKeyManager,
} from "@/layers";
import { startHttpServer } from "@/mcp";

export const startMcpHandler = (sessionKeyAlias: Option.Option<string>) =>
  Effect.gen(function* () {
    const accountManager = yield* AccountManager;
    const sessionKeyManager = yield* SessionKeyManager;

    // 1. Select Account
    const account = yield* accountManager.selectAccount({
      existingAlias: sessionKeyAlias,
      message: "Select the smart account to use for the MCP server",
    });

    // 2. Multi Select Session Keys
    const sessionKeys = yield* sessionKeyManager.multiSelectSessionKeys({
      message: "Select session keys to use for the MCP server",
    });

    const keys: CurrentMcpContextShape["sessionKeys"] = [];

    // 3. Get Private Keys
    for (const key of sessionKeys) {
      const signer = yield* sessionKeyManager.getSessionKeySigner({
        identifier: key.identifier,
        message: `Enter password for session key - ${key.alias ?? key.identifier}:`,
      });

      keys.push({
        ...key.data,
        signer,
      });
    }
    const currentContext = CurrentMcpContext.of({
      account,
      sessionKeys: keys,
    });

    yield* startHttpServer(8080).pipe(
      Effect.provideService(CurrentMcpContext, currentContext),
    );
  });

const sessionKey = Flag.string("session-key").pipe(
  Flag.withAlias("sk"),
  Flag.optional,
  Flag.withDescription("The session key alias to use for the MCP server"),
);

export const startMcpCommand = Command.make(
  "start",
  { sessionKey },
  ({ sessionKey }) => startMcpHandler(sessionKey),
).pipe(
  Command.withAlias("s"),
  Command.withDescription("Starts the local MCP server."),
  Command.withExamples([]),
);
