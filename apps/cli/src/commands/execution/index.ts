import { Effect, Option, Schema } from "effect";
import { Argument, Command, Flag } from "effect/cli";

import { ExecutionId, ExecutionSubmissionId } from "@namera-ai/protocol";
import { ExecuteRequest, SimulateExecutionRequest } from "@namera-ai/protocol/dto";

import { paramsFlag, profileFlag, resolveParams } from "#/commands/common";
import { sponsorshipInput, transactionFlags, transactionInput } from "#/commands/execution/input";
import { ask, optionalInput, parseInput, rejectMixedParams } from "#/commands/operation-input";
import { nameraCommand } from "#/commands/root";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";
import {
  executionStatusView,
  executionsView,
  simulationView,
  operationContextView,
  type OperationContext,
} from "#/services/output/execution";
import { CliPrompts } from "#/services/prompts";

const execute = Command.make(
  "execute",
  {
    params: paramsFlag,
    profile: profileFlag,
    ...transactionFlags,
    sponsor: optionalInput("sponsor", "Use sponsored gas: true or false"),
    maxGasCost: Flag.String("max-gas-cost-wei").pipe(
      Flag.withDescription("Maximum gas cost in wei when paying gas yourself"),
      Flag.optional,
    ),
  },
  Effect.fn(function* ({ params, profile, maxGasCost, sponsor, ...input }) {
    yield* rejectMixedParams(params, [...Object.values(input), sponsor]);
    const connection = yield* Effect.tryPromise(() => makeCliClient(profile));
    let context: OperationContext | undefined;
    const request = yield* resolveParams(
      params,
      ExecuteRequest,
      Effect.gen(function* () {
        const transaction = yield* transactionInput(connection.client, input);
        context = transaction.scope;
        return { ...transaction.request, sponsor: yield* sponsorshipInput(sponsor) };
      }),
    );
    let maxGasCostWei: bigint | undefined;
    if (Option.isSome(maxGasCost)) {
      maxGasCostWei = yield* parseInput(
        Schema.BigIntFromString.check(Schema.isGreaterThanOrEqualToBigInt(0n)),
        maxGasCost.value,
        "max-gas-cost-wei",
      );
    } else if (request.sponsor === false && Option.isNone(params)) {
      const prompts = yield* CliPrompts;
      maxGasCostWei = yield* ask(
        "max-gas-cost-wei",
        prompts.ethereumValue("Maximum total gas cost (wei)"),
      );
    }
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile, maxGasCostWei));
    yield* printValue(yield* runPromise(client.executions.execute(request)), (value, colors) =>
      [operationContextView(context, request.chainId, colors), executionStatusView(value, colors)]
        .filter(Boolean)
        .join("\n"),
    );
  }),
).pipe(Command.withDescription("Submit a transaction using a session key"));

const simulate = Command.make(
  "simulate",
  { params: paramsFlag, profile: profileFlag, ...transactionFlags },
  Effect.fn(function* ({ params, profile, ...input }) {
    yield* rejectMixedParams(params, Object.values(input));
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    let context: OperationContext | undefined;
    const request = yield* resolveParams(
      params,
      SimulateExecutionRequest,
      transactionInput(client, input).pipe(
        Effect.map((value) => {
          context = value.scope;
          return value.request;
        }),
      ),
    );
    yield* printValue(yield* runPromise(client.executions.simulate(request)), (value, colors) =>
      simulationView(value, colors, context),
    );
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
    const result = yield* runPromise(client.executions.getStatus(id));
    const { output, quiet } = yield* nameraCommand;
    const details =
      output === "pretty" && !quiet && result.status === "confirmed"
        ? yield* runPromise(client.executions.get(result.execution.id))
        : undefined;
    yield* printValue(result, (value, colors) => executionStatusView(value, colors, details));
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
