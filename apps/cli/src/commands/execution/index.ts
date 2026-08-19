import { readFile } from "node:fs/promises";

import { Effect, Option, Schema } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { ExecutionId, ExecutionSubmissionId } from "@namera-ai/protocol";
import { ExecuteRequest } from "@namera-ai/protocol/dto";

import { jsonFlag, profileFlag } from "#/commands/common";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";

const execute = Command.make(
  "execute",
  {
    file: Flag.string("file").pipe(Flag.withDescription("JSON execution request file")),
    profile: profileFlag,
    json: jsonFlag,
  },
  Effect.fn(function* ({ file, profile, json }) {
    const raw = yield* Effect.tryPromise(() => readFile(file, "utf8"));
    const request = yield* Schema.decodeUnknownEffect(ExecuteRequest)(JSON.parse(raw));
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.executions.execute(request)), json);
  }),
);

const simulate = Command.make(
  "simulate",
  {
    file: Flag.string("file").pipe(Flag.withDescription("JSON execution request file")),
    profile: profileFlag,
    json: jsonFlag,
  },
  Effect.fn(function* ({ file, profile, json }) {
    const raw = yield* Effect.tryPromise(() => readFile(file, "utf8"));
    const request = yield* Schema.decodeUnknownEffect(ExecuteRequest)(JSON.parse(raw));
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.executions.simulate(request)), json);
  }),
).pipe(
  Command.withDescription(
    "Simulate calls and evaluate session-key policies without signing or submitting",
  ),
);

const status = Command.make(
  "status",
  { submissionId: Argument.string("submission-id"), profile: profileFlag, json: jsonFlag },
  Effect.fn(function* ({ submissionId, profile, json }) {
    const id = yield* Schema.decodeUnknownEffect(ExecutionSubmissionId)(submissionId);
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.executions.getStatus(id)), json);
  }),
);

const list = Command.make(
  "list",
  {
    cursor: Flag.string("cursor").pipe(Flag.optional),
    profile: profileFlag,
    json: jsonFlag,
  },
  Effect.fn(function* ({ cursor, profile, json }) {
    const decodedCursor = Option.isSome(cursor)
      ? yield* Schema.decodeUnknownEffect(ExecutionId)(cursor.value)
      : undefined;
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(
      yield* runPromise(
        client.executions.list(decodedCursor === undefined ? {} : { cursor: decodedCursor }),
      ),
      json,
    );
  }),
);

export const executionCommand = Command.make("execution").pipe(
  Command.withDescription("Execute and inspect onchain operations"),
  Command.withSubcommands([execute, simulate, status, list]),
);
