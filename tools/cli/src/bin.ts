#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Array as Arr, Console, Effect, Layer, String as Str } from "effect";
import { Command } from "effect/cli";
import { FetchHttpClient } from "effect/http";

import { cli } from "./cli.ts";
import { Tools } from "./services/Tools.ts";

const services = Tools.layer.pipe(
  Layer.provideMerge(NodeServices.layer),
  Layer.provideMerge(FetchHttpClient.layer),
);

const report = (lines: readonly string[]) =>
  Console.error(Arr.join(lines, "\n")).pipe(
    Effect.andThen(Effect.sync(() => (process.exitCode = 1))),
  );

cli.pipe(
  Command.run({ version: "0.0.0" }),
  Effect.catchTags({
    CheckFailed: ({ check, problems }) => report([...problems, `${check}: failed`]),
    ToolFailed: ({ tool, output }) => report([Str.trim(output), `${tool}: failed`]),
    SetupError: ({ message }) => report([message]),
  }),
  Effect.provide(services),
  NodeRuntime.runMain,
);
