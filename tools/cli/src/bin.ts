#!/usr/bin/env node
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Arr from "effect/Array"
import * as Command from "effect/cli/Command"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Layer from "effect/Layer"
import * as Str from "effect/String"

import { cli } from "./cli.ts"
import * as Environment from "./contracts/environment.ts"
import { Tools } from "./services/Tools.ts"

const services = Layer.mergeAll(Tools.layer, Environment.layer).pipe(
  Layer.provideMerge(NodeServices.layer),
  Layer.provideMerge(FetchHttpClient.layer)
)

const report = (lines: ReadonlyArray<string>) =>
  Console.error(Arr.join(lines, "\n")).pipe(
    Effect.andThen(Effect.sync(() => (process.exitCode = 1)))
  )

cli.pipe(
  Command.run({ version: "0.0.0" }),
  Effect.catchTags({
    CheckFailed: ({ check, problems }) => report([...problems, `${check}: failed`]),
    ToolFailed: ({ tool, output }) => report([Str.trim(output), `${tool}: failed`]),
    SetupError: ({ message }) => report([message])
  }),
  Effect.provide(services),
  NodeRuntime.runMain
)
