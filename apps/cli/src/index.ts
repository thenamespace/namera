import "dotenv/config";

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { ConfigProvider, Console, Effect, Layer } from "effect";
import { CliError, Command } from "effect/unstable/cli";

import { commands } from "./commands";
import { globalFlags } from "./flags/global";
import {
  ConfigManager,
  KeystoreManager,
  McpManager,
  OutputFormatter,
  PromptManager,
  SessionKeyManager,
  SmartAccountManager,
  Web3Service,
} from "./layers";

const command = Command.make("namera", {}, () =>
  Effect.fail(
    new CliError.ShowHelp({
      commandPath: ["namera"],
      errors: [],
    }),
  ),
).pipe(
  Command.withDescription(
    "Programmable Session keys for Smart Contracts Accounts.",
  ),
  Command.withGlobalFlags(globalFlags),
  Command.withSubcommands(commands),
  Command.withExamples([
    {
      command: "namera --help",
      description: "Print help",
    },
    {
      command: "namera --version",
      description: "Print version",
    },
  ]),
);

const Layers = McpManager.layer.pipe(
  Layer.provideMerge(SessionKeyManager.layer),
  Layer.provideMerge(SmartAccountManager.layer),
  Layer.provideMerge(KeystoreManager.layer),
  Layer.provideMerge(Web3Service.layer),
  Layer.provideMerge(PromptManager.layer),
  Layer.provideMerge(ConfigManager.layer),
  Layer.provideMerge(OutputFormatter.layer),
  Layer.provideMerge(NodeServices.layer),
);

const cli = Effect.gen(function* () {
  const configManager = yield* ConfigManager.ConfigManager;
  yield* configManager.ensureConfigDirExists();

  yield* Command.run(command, {
    version: "0.0.1",
  });
}).pipe(
  Effect.provide(Layers),
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromEnv(),
  ),
  Effect.catchTag("ShowHelp", () => Effect.succeed(void 0)),
  Effect.catch((e) => Console.error(e.message)),
);

// @ts-expect-error - TODO: fix this
cli.pipe(NodeRuntime.runMain);
