import { Effect, Option, Schema } from "effect";
import { Argument, Command, Flag } from "effect/cli";

import { ExecutionId, ExecutionSubmissionId } from "@namera-ai/protocol";
import {
  ExecuteRequest,
  type ExecuteRequest as ExecuteRequestType,
  SimulateExecutionRequest,
  type SimulateExecutionRequest as SimulateExecutionRequestType,
} from "@namera-ai/protocol/dto";

import { paramsFlag, profileFlag, resolveParams } from "#/commands/common";
import { nameraCommand } from "#/commands/root";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";
import { executionStatusView, executionsView, simulationView } from "#/services/output/execution";
import { CliPrompts } from "#/services/prompts";

const promptTransactionRequest = Effect.fn("cli.execution.promptTransactionRequest")(function* () {
  const prompts = yield* CliPrompts;
  const namespace = yield* prompts.namespace;
  const walletId = yield* prompts.walletId();
  const sessionKeyId = yield* prompts.sessionKeyId();
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

  return {
    namespace,
    walletId,
    sessionKeyId,
    chainId,
    calls,
  } satisfies SimulateExecutionRequestType;
});

const promptExecutionRequest = Effect.fn("cli.execution.promptExecutionRequest")(function* () {
  const prompts = yield* CliPrompts;
  const request = yield* promptTransactionRequest();
  const sponsor = yield* prompts.confirm("Sponsor gas with Namera?", true);

  return { ...request, sponsor } satisfies ExecuteRequestType;
});

const execute = Command.make(
  "execute",
  {
    params: paramsFlag,
    profile: profileFlag,
    maxGasCost: Flag.String("max-gas-cost-wei").pipe(
      Flag.withDescription("Maximum gas cost in wei when paying gas yourself"),
      Flag.optional,
    ),
  },
  Effect.fn(function* ({ params, profile, maxGasCost }) {
    const request = yield* resolveParams(params, ExecuteRequest, promptExecutionRequest());
    let maxGasCostWei: bigint | undefined;
    if (Option.isSome(maxGasCost)) {
      maxGasCostWei = yield* Schema.decodeUnknownEffect(
        Schema.BigIntFromString.check(Schema.isGreaterThanOrEqualToBigInt(0n)),
      )(maxGasCost.value);
    } else if (request.sponsor === false && Option.isNone(params)) {
      const prompts = yield* CliPrompts;
      maxGasCostWei = yield* prompts.ethereumValue("Maximum total gas cost (wei)");
    }
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile, maxGasCostWei));
    yield* printValue(yield* runPromise(client.executions.execute(request)), executionStatusView);
  }),
).pipe(Command.withDescription("Submit a transaction using a session key"));

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
    yield* printValue(yield* runPromise(client.executions.simulate(request)), simulationView);
  }),
).pipe(Command.withDescription("Preview a transaction and check permissions without sending it"));

const status = Command.make(
  "status",
  {
    submissionId: Argument.String("submission-id").pipe(
      Argument.withDescription("Submission ID returned when you sent the transaction"),
    ),
    profile: profileFlag,
  },
  Effect.fn(function* ({ submissionId, profile }) {
    const id = yield* Schema.decodeUnknownEffect(ExecutionSubmissionId)(submissionId);
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.executions.getStatus(id)), executionStatusView);
  }),
).pipe(Command.withDescription("Check a submitted transaction's status"));

const list = Command.make(
  "list",
  {
    cursor: Flag.String("cursor").pipe(
      Flag.withDescription("Continue from the next cursor returned by the previous page"),
      Flag.optional,
    ),
    profile: profileFlag,
  },
  Effect.fn(function* ({ cursor, profile }) {
    const decodedCursor = Option.isSome(cursor)
      ? yield* Schema.decodeUnknownEffect(ExecutionId)(cursor.value)
      : undefined;
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    const result = yield* runPromise(
      client.executions.list(decodedCursor === undefined ? {} : { cursor: decodedCursor }),
    );
    const { output, quiet } = yield* nameraCommand;
    const items =
      output === "pretty" && !quiet
        ? yield* Effect.forEach(
            result.items,
            (item) => runPromise(client.executions.get(item.details.id)),
            { concurrency: 4 },
          )
        : [];
    yield* printValue(result, (_, colors) =>
      executionsView({ items, nextCursor: result.nextCursor }, colors),
    );
  }),
).pipe(Command.withDescription("View your transaction history"));

export const executionCommand = Command.make("execution").pipe(
  Command.withDescription("Preview, send, and track transactions"),
  Command.withSubcommands([execute, simulate, status, list]),
);
