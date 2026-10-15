import { Effect, Metric } from "effect";

import type { ExecutionError } from "@namera-ai/protocol";
import type {
  GrantedActorData,
  SimulateExecutionRequest,
  SimulateExecutionResponse,
} from "@namera-ai/protocol/dto";
import { executionDuration, executionResults } from "@namera-ai/telemetry";

import { makePrepareExecution } from "./preparation.js";

export interface ExecutionSimulationApplication {
  readonly simulate: (input: {
    readonly actor: GrantedActorData;
    readonly request: SimulateExecutionRequest;
  }) => Effect.Effect<SimulateExecutionResponse, ExecutionError>;
}

export const makeExecutionSimulationApplication = Effect.gen(function* () {
  const prepareExecution = yield* makePrepareExecution;

  const simulate = Effect.fn("application.execution.simulate")(
    function* (input: {
      readonly actor: GrantedActorData;
      readonly request: SimulateExecutionRequest;
    }) {
      const { prepared, authority } = yield* prepareExecution({
        actor: input.actor,
        request: { ...input.request, sponsor: false },
        custody: "either",
      });
      const response = {
        namespace: "eip155" as const,
        walletId: input.request.walletId,
        chainId: input.request.chainId,
        account: prepared.context.account,
        callsSucceeded: prepared.context.simulation.calls.results.every(
          (result) => result.status === "success",
        ),
        simulation: prepared.context.simulation,
      };
      return { ...response, allowed: true as const, sessionKeyId: authority.sessionKey.id };
    },
    Effect.catchTag("DatabaseError", Effect.die),
    Effect.tap((result) =>
      Metric.update(
        Metric.withAttributes(executionResults, {
          stage: "simulate",
          result: result.allowed ? "allowed" : "denied",
        }),
        1,
      ),
    ),
    Effect.tapError((error) =>
      Metric.update(
        Metric.withAttributes(executionResults, { stage: "simulate", result: error.code }),
        1,
      ),
    ),
    Effect.trackDuration(Metric.withAttributes(executionDuration, { stage: "simulate" })),
  );

  return { simulate } satisfies ExecutionSimulationApplication;
});
