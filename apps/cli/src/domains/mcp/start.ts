import { Console, Effect, Result } from "effect";
import { Command } from "effect/unstable/cli";

export const startMcpHandler = () =>
  Effect.gen(function* () {
    yield* Effect.log("hi");
  });

export const startMcpCommand = Command.make("start", {}, () =>
  startMcpHandler(),
).pipe(
  Command.withAlias("s"),
  Command.withDescription("Starts the local MCP server."),
  Command.withExamples([]),
);
