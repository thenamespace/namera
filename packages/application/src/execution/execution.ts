import { Effect } from "effect";

import type { ExecutionError, BillingError } from "@namera-ai/protocol";
import type {
  CompleteExecutionRequest,
  CompleteExecutionResponse,
  GrantedActorData,
  PrepareExecutionRequest,
  PrepareExecutionResponse,
  PrepareManagedExecutionResponse,
  CompleteManagedExecutionRequest,
} from "@namera-ai/protocol/dto";

import { makeCompleteLocalExecution } from "./complete-local.js";
import { makePrepareLocalExecution } from "./prepare-local.js";
import { makeExecutionReadApplication, type ExecutionReadApplication } from "./read.js";
import { makeExecutionReconciliation } from "./reconciliation.js";
import {
  makeExecutionSimulationApplication,
  type ExecutionSimulationApplication,
} from "./simulation.js";

export interface ExecutionApplication
  extends ExecutionReadApplication, ExecutionSimulationApplication {
  readonly prepare: (input: {
    readonly actor: GrantedActorData;
    readonly idempotencyKey: string;
    readonly request: PrepareExecutionRequest;
  }) => Effect.Effect<PrepareExecutionResponse, BillingError | ExecutionError>;
  readonly complete: (input: {
    readonly actor: GrantedActorData;
    readonly request: CompleteExecutionRequest;
  }) => Effect.Effect<CompleteExecutionResponse, ExecutionError>;
  readonly reconcile: () => Effect.Effect<number>;
  readonly prepareManaged: (
    input: Parameters<ExecutionApplication["prepare"]>[0],
  ) => Effect.Effect<PrepareManagedExecutionResponse, BillingError | ExecutionError>;
  readonly completeManaged: (input: {
    readonly actor: GrantedActorData;
    readonly request: CompleteManagedExecutionRequest;
  }) => Effect.Effect<CompleteExecutionResponse, ExecutionError>;
}

export const makeExecutionApplication = Effect.gen(function* () {
  const prepare = yield* makePrepareLocalExecution;
  const complete = yield* makeCompleteLocalExecution;
  const read = yield* makeExecutionReadApplication;
  const simulation = yield* makeExecutionSimulationApplication;
  const reconciliation = yield* makeExecutionReconciliation;
  return {
    prepare,
    complete,
    prepareManaged: (input) =>
      prepare({ ...input, custody: "namera-managed" }).pipe(
        Effect.map(({ signing: _signing, ...result }) => result),
      ),
    completeManaged: (input) => complete({ ...input, custody: "namera-managed" }),
    reconcile: reconciliation.reconcile,
    ...read,
    ...simulation,
  } satisfies ExecutionApplication;
});
