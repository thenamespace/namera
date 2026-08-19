import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { ExecutionError, type EvmPolicyDeniedDecision, type PolicyId } from "@namera-ai/protocol";
import type {
  GrantedActorData,
  SimulateExecutionRequest,
  SimulateExecutionResponse,
} from "@namera-ai/protocol/dto";
import type { EvmSessionKey } from "@namera-ai/protocol/model";

import { makePrepareExecution } from "#/execution/preparation";

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
      const { prepared, candidates } = yield* prepareExecution(input);

      const callsSucceeded = prepared.context.simulation.calls.results.every(
        (result) => result.status === "success",
      );
      const denials: Array<
        EvmPolicyDeniedDecision & { readonly sessionKeyId: EvmSessionKey["id"] }
      > = [];

      for (const candidate of candidates) {
        const seeds = yield* evm.policy.getStateSeeds({
          policies: candidate.sessionKey.policies,
          context: prepared.context,
        });
        const policyIds = [...new Set(seeds.map((seed) => seed.policyId))];
        const persistedStates = (yield* Effect.forEach(policyIds, (policyId) =>
          repository.core.sessionKeyPolicyState.findForPolicy(
            input.actor.organizationId,
            candidate.sessionKey.id,
            policyId,
          ),
        )).flat();
        const persistedByScope = new Map(
          persistedStates.map((state) => [stateScopeKey(state.policyId, state.stateKey), state]),
        );
        const states = seeds.map(
          (seed) => persistedByScope.get(stateScopeKey(seed.policyId, seed.stateKey)) ?? seed,
        );
        // Policy reservation planning is pure. Supplying point-in-time states
        // evaluates current periodic and lifetime usage without persisting the
        // returned state changes or reservations.
        const preview = yield* evm.policy.reserve({
          policies: candidate.sessionKey.policies,
          context: prepared.context,
          states,
        });
        if (preview.decision.allowed) {
          return {
            namespace: "eip155" as const,
            walletId: input.request.walletId,
            chainId: input.request.chainId,
            account: prepared.context.account,
            callsSucceeded,
            simulation: prepared.context.simulation,
            allowed: true as const,
            sessionKeyId: candidate.sessionKey.id,
          };
        }

        denials.push({ sessionKeyId: candidate.sessionKey.id, ...preview.decision });
      }

      const [firstDenial, ...remainingDenials] = denials;
      if (firstDenial === undefined) {
        return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
      }

      return {
        namespace: "eip155" as const,
        walletId: input.request.walletId,
        chainId: input.request.chainId,
        account: prepared.context.account,
        callsSucceeded,
        simulation: prepared.context.simulation,
        allowed: false as const,
        denials: [firstDenial, ...remainingDenials],
      };
    },
    Effect.catchTag("DatabaseError", Effect.die),
    Effect.catchTag("EvmPolicyError", () => new ExecutionError({ code: "EXECUTION_UNAVAILABLE" })),
  );

  return { simulate } satisfies ExecutionSimulationApplication;
});
