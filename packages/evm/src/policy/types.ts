import type { DateTime, Effect } from "effect";

import type {
  EvmExecutionReceipt,
  EvmIntentContext,
  EvmPolicyDecision,
  EvmPolicyError,
  EvmSignatureContext,
  EvmSignaturePolicyDecision,
  PolicyId,
} from "@namera-ai/protocol";
import type {
  EvmSessionKeyPolicies,
  SessionKeyPolicyReservation,
  SessionKeyPolicyState,
} from "@namera-ai/protocol/model";

export type EvaluateEvmPoliciesInput = {
  readonly policies: EvmSessionKeyPolicies;
  readonly context: EvmIntentContext;
};

export type EvaluateEvmSignaturePoliciesInput = {
  readonly policies: EvmSessionKeyPolicies;
  readonly context: EvmSignatureContext;
};

export type EvmPolicyStateInput = Pick<SessionKeyPolicyState, "policyId" | "stateKey" | "data">;

export type EvmPolicyReservationInput = Pick<
  SessionKeyPolicyReservation,
  "policyId" | "stateKey" | "data"
>;

export type EvmPolicyStateChange = {
  readonly policyId: PolicyId;
  readonly stateKey: string;
  readonly stateVersion: number;
  readonly data: SessionKeyPolicyState["data"];
};

export type EvmPolicyStateSeed = EvmPolicyStateChange;

export type EvmPolicyReservationPlan = {
  readonly policyId: PolicyId;
  readonly stateKey: string;
  readonly reservationVersion: number;
  readonly data: SessionKeyPolicyReservation["data"];
};

export type ReserveEvmPoliciesInput = EvaluateEvmPoliciesInput & {
  readonly states: ReadonlyArray<EvmPolicyStateInput>;
};

export type ReserveEvmPoliciesResult = {
  readonly decision: EvmPolicyDecision;
  readonly stateChanges: ReadonlyArray<EvmPolicyStateChange>;
  readonly reservations: ReadonlyArray<EvmPolicyReservationPlan>;
};

type CompleteEvmPolicyOperationInput = {
  readonly policies: EvmSessionKeyPolicies;
  readonly states: ReadonlyArray<EvmPolicyStateInput>;
  readonly reservations: ReadonlyArray<EvmPolicyReservationInput>;
};

export type SettleEvmPoliciesInput = CompleteEvmPolicyOperationInput & {
  readonly result: Extract<EvmExecutionReceipt, { readonly success: true }>;
};

export type ReleaseEvmPoliciesInput = CompleteEvmPolicyOperationInput;

export interface EvmPolicyService {
  readonly executionDeadline: (input: {
    readonly policies: EvmSessionKeyPolicies;
    readonly latest: DateTime.Utc;
  }) => DateTime.Utc;
  readonly evaluate: (
    input: EvaluateEvmPoliciesInput,
  ) => Effect.Effect<EvmPolicyDecision, EvmPolicyError>;
  readonly evaluateSignature: (
    input: EvaluateEvmSignaturePoliciesInput,
  ) => Effect.Effect<EvmSignaturePolicyDecision, EvmPolicyError>;
  readonly getStateSeeds: (
    input: EvaluateEvmPoliciesInput,
  ) => Effect.Effect<ReadonlyArray<EvmPolicyStateSeed>, EvmPolicyError>;
  readonly reserve: (
    input: ReserveEvmPoliciesInput,
  ) => Effect.Effect<ReserveEvmPoliciesResult, EvmPolicyError>;
  readonly settle: (
    input: SettleEvmPoliciesInput,
  ) => Effect.Effect<ReadonlyArray<EvmPolicyStateChange>, EvmPolicyError>;
  readonly release: (
    input: ReleaseEvmPoliciesInput,
  ) => Effect.Effect<ReadonlyArray<EvmPolicyStateChange>, EvmPolicyError>;
}
