import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";

import { subCommands } from "./domains";
import {
  AccountManagerLive,
  AliasManagerLive,
  ConfigManager,
  ConfigManagerLive,
  KeystoreManagerLive,
} from "./layers";

const command = Command.make("namera", {}, () => Effect.void).pipe(
  Command.withSubcommands([...subCommands]),
);

const cli = Command.run(command, {
  version: "v0.0.1",
});

const main = Effect.gen(function* () {
  const configManager = yield* ConfigManager;
  yield* configManager.ensureConfigDirExists();

  yield* cli;
});

const Layers = KeystoreManagerLive.pipe(
  Layer.provideMerge(AccountManagerLive),
  Layer.provideMerge(AliasManagerLive),
  Layer.provideMerge(ConfigManagerLive),
  Layer.provideMerge(NodeServices.layer),
);

main.pipe(Effect.provide(Layers), NodeRuntime.runMain);
