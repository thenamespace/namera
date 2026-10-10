import { Effect, Metric } from "effect";

import { Repository } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { ExecutionError, type PolicyId } from "@namera-ai/protocol";
import type {
  GrantedActorData,
  SimulateExecutionRequest,
  SimulateExecutionResponse,
} from "@namera-ai/protocol/dto";
import {
  executionDuration,
  executionResults,
  executionPolicyDecisions,
} from "@namera-ai/telemetry";

import { makePrepareExecution } from "./preparation.js";

const stateScopeKey = (policyId: PolicyId, stateKey: string) => `${policyId}:${stateKey}`;

export interface ExecutionSimulationApplication {
  readonly simulate: (input: {
    readonly actor: GrantedActorData;
    readonly request: SimulateExecutionRequest;
  }) => Effect.Effect<SimulateExecutionResponse, ExecutionError>;
}

export const makeExecutionSimulationApplication = Effect.gen(function* () {
  const evm = yield* Evm;
  const repository = yield* Repository;
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
      const sessionKey = authority.sessionKey;
      const seeds = yield* evm.policy.getStateSeeds({
        policies: sessionKey.policies,
        context: prepared.context,
      });
      const policyIds = [...new Set(seeds.map((seed) => seed.policyId))];
      const persistedStates = (yield* Effect.forEach(policyIds, (policyId) =>
        repository.core.sessionKeyPolicyState.findForPolicy(
          input.actor.organizationId,
          sessionKey.id,
          policyId,
        ),
      )).flat();
      const persistedByScope = new Map(
        persistedStates.map((state) => [stateScopeKey(state.policyId, state.stateKey), state]),
      );
      const states = seeds.map(
        (seed) => persistedByScope.get(stateScopeKey(seed.policyId, seed.stateKey)) ?? seed,
      );
      // Reservation planning is pure: do not persist seeds, changes or holds for a preview.
      const preview = yield* evm.policy.reserve({
        policies: sessionKey.policies,
        context: prepared.context,
        states,
      });
      yield* Metric.update(
        Metric.withAttributes(executionPolicyDecisions, {
          stage: "simulate",
          result: preview.decision.allowed ? "allowed" : "denied",
        }),
        1,
      );
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
      return preview.decision.allowed
        ? { ...response, allowed: true as const, sessionKeyId: sessionKey.id }
        : {
            ...response,
            allowed: false as const,
            denials: [{ sessionKeyId: sessionKey.id, ...preview.decision }],
          };
    },
    Effect.catchTag("DatabaseError", Effect.die),
    Effect.catchTag("EvmPolicyError", () => new ExecutionError({ code: "EXECUTION_UNAVAILABLE" })),
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
