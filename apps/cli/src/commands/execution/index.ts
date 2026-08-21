import { Effect, Option, Schema } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { ExecutionId, ExecutionSubmissionId } from "@namera-ai/protocol";
import {
  ExecuteRequest,
  type ExecuteRequest as ExecuteRequestType,
  SimulateExecutionRequest,
  type SimulateExecutionRequest as SimulateExecutionRequestType,
} from "@namera-ai/protocol/dto";

import { paramsFlag, profileFlag, resolveParams } from "#/commands/common";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";
import { CliPrompts } from "#/services/prompts";

const promptTransactionRequest = Effect.fn("cli.execution.promptTransactionRequest")(function* () {
  const prompts = yield* CliPrompts;
  const namespace = yield* prompts.namespace;
  const walletId = yield* prompts.walletId();
  const chainId = yield* prompts.chainId();
  const callCount = yield* prompts.integer("Number of calls", { min: 1, default: 1 });
  const calls = yield* Effect.forEach(
    Array.from({ length: callCount }, (_, index) => index),
    (index) =>
      Effect.gen(function* () {
        const number = callCount === 1 ? "" : ` ${index + 1}`;
        return {
          to: yield* prompts.ethereumAddress(`Recipient${number}`),
          value: yield* prompts.ethereumValue(`Native value${number} (wei)`),
          data: yield* prompts.hex(`Calldata${number}`),
        };
      }),
  );

  return { namespace, walletId, chainId, calls } satisfies SimulateExecutionRequestType;
});

const promptExecutionRequest = Effect.fn("cli.execution.promptExecutionRequest")(function* () {
  const prompts = yield* CliPrompts;
  const request = yield* promptTransactionRequest();
  const sponsor = yield* prompts.confirm("Sponsor gas with Namera?", true);

  return { ...request, sponsor } satisfies ExecuteRequestType;
});

const execute = Command.make(
  "execute",
  { params: paramsFlag, profile: profileFlag },
  Effect.fn(function* ({ params, profile }) {
    const request = yield* resolveParams(params, ExecuteRequest, promptExecutionRequest());
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.executions.execute(request)));
  }),
).pipe(Command.withDescription("Execute EVM calls after validating an inline or prompted request"));

const simulate = Command.make(
  "simulate",
  { params: paramsFlag, profile: profileFlag },
  Effect.fn(function* ({ params, profile }) {
    const request = yield* resolveParams(
      params,
      SimulateExecutionRequest,
      promptTransactionRequest(),
    );
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.executions.simulate(request)));
  }),
).pipe(
  Command.withDescription(
    "Simulate calls and evaluate session-key policies without signing or submitting",
  ),
);

const status = Command.make(
  "status",
  { submissionId: Argument.string("submission-id"), profile: profileFlag },
  Effect.fn(function* ({ submissionId, profile }) {
    const id = yield* Schema.decodeUnknownEffect(ExecutionSubmissionId)(submissionId);
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.executions.getStatus(id)));
  }),
);

const list = Command.make(
  "list",
  {
    cursor: Flag.string("cursor").pipe(Flag.optional),
    profile: profileFlag,
  },
  Effect.fn(function* ({ cursor, profile }) {
    const decodedCursor = Option.isSome(cursor)
      ? yield* Schema.decodeUnknownEffect(ExecutionId)(cursor.value)
      : undefined;
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(
      yield* runPromise(
        client.executions.list(decodedCursor === undefined ? {} : { cursor: decodedCursor }),
      ),
    );
  }),
);

export const executionCommand = Command.make("execution").pipe(
  Command.withDescription("Execute and inspect onchain operations"),
  Command.withSubcommands([execute, simulate, status, list]),
);
