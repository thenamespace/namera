import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";

import { subCommands } from "./domains";
import { AliasManagerLive, ConfigManager, ConfigManagerLive } from "./layers";

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

const Layers = AliasManagerLive.pipe(
  Layer.provideMerge(ConfigManagerLive),
  Layer.provideMerge(NodeServices.layer),
);

main.pipe(Effect.provide(Layers), NodeRuntime.runMain);
