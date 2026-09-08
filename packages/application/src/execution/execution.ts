import { Effect } from "effect";

import { ExecutionError, type BillingError } from "@namera-ai/protocol";
import type {
  CompleteExecutionRequest,
  CompleteExecutionResponse,
  ExecuteRequest,
  ExecuteResponse,
  GrantedActorData,
  PrepareExecutionRequest,
  PrepareExecutionResponse,
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
  readonly execute: (input: {
    readonly actor: GrantedActorData;
    readonly idempotencyKey: string;
    readonly request: ExecuteRequest;
  }) => Effect.Effect<ExecuteResponse, BillingError | ExecutionError>;
  readonly reconcile: () => Effect.Effect<number>;
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
    // Removed with the old transport once clients use prepare/complete. Never
    // fall back to the root owner while clients are being migrated.
    execute: Effect.fn("application.execution.executeDisabled")(function* () {
      return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
    }),
    reconcile: reconciliation.reconcile,
    ...read,
    ...simulation,
  } satisfies ExecutionApplication;
});
