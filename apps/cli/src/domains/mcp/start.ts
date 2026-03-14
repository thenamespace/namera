import { Effect, type Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { SessionKeyManager } from "@/layers";

export const startMcpHandler = (sessionKeyAlias: Option.Option<string>) =>
  Effect.gen(function* () {
    const sessionKeyManager = yield* SessionKeyManager;

    const key = yield* sessionKeyManager.selectSessionKey({
      existingAlias: sessionKeyAlias,
      message: "Select the session key to use for the MCP server",
    });

    const client = yield* sessionKeyManager.getSessionKeyClient({
      alias: key.alias ?? "",
    });

    yield* Effect.log(client.account.address);
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
