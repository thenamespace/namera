#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { authCommand, loginCommand, logoutCommand } from "#/commands/auth/index";
import { executionCommand } from "#/commands/execution/index";
import { mcpCommand } from "#/commands/mcp/index";
import { nameraCommand } from "#/commands/root";
import { sessionKeyCommand } from "#/commands/session-key/index";
import { signCommand } from "#/commands/sign";
import { verifySignatureCommand } from "#/commands/verify-signature";
import { walletCommand } from "#/commands/wallet/index";
import { CliPrompts } from "#/services/prompts";

const namera = nameraCommand.pipe(
  Command.withSubcommands([
    loginCommand,
    logoutCommand,
    authCommand,
    walletCommand,
    sessionKeyCommand,
    executionCommand,
    mcpCommand,
    signCommand,
    verifySignatureCommand,
  ]),
);

namera.pipe(
  Command.run({ version: "0.1.0" }),
  Effect.provide(CliPrompts.layer),
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain,
);
