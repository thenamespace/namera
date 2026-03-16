import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { ConfigProvider, Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";

import "dotenv/config";

import { subCommands } from "./domains";
import {
  AccountManagerLive,
  AliasManagerLive,
  ConfigManager,
  ConfigManagerLive,
  KeystoreManagerLive,
  PromptManagerLive,
  SessionKeyManagerLive,
} from "./layers";

const command = Command.make("namera", {}, () => Effect.void).pipe(
  Command.withSubcommands([...subCommands]),
);

const cli = Command.run(command, {
  version: "v0.0.1",
});

const Layers = SessionKeyManagerLive.pipe(
  Layer.provideMerge(KeystoreManagerLive),
  Layer.provideMerge(PromptManagerLive),
  Layer.provideMerge(AccountManagerLive),
  Layer.provideMerge(AliasManagerLive),
  Layer.provideMerge(ConfigManagerLive),
  Layer.provideMerge(NodeServices.layer),
);

const main = Effect.gen(function* () {
  const configManager = yield* ConfigManager;
  yield* configManager.ensureConfigDirExists();

  yield* cli;
}).pipe(
  Effect.provide(Layers),
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromEnv(),
  ),
);

main.pipe(NodeRuntime.runMain);
