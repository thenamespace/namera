import { Effect, Schema } from "effect";

import {
  EvmPolicyError,
  type EvmExecutionReceipt,
  type EvmIntentContext,
  type EvmPolicyDecision,
  type EvmSignatureContext,
  type PolicyApplicability,
} from "@namera-ai/protocol";
import type {
  CreateEvmSessionKeyPolicy,
  EvmSessionKeyPolicy,
  SessionKeyPolicyReservation,
  SessionKeyPolicyState,
} from "@namera-ai/protocol/model";

import {
  EvmChainAllowlistPolicyHandler,
  EvmChainAllowlistSignaturePolicyHandler,
} from "./policies/chain-allowlist.js";
import { EvmGasBudgetPolicyHandler } from "./policies/gas-budget.js";
import { EvmNativeSpendLimitPolicyHandler } from "./policies/native-spend-limit.js";
import { EvmSignaturePolicyHandler } from "./policies/signature.js";
import {
  EvmTimeWindowPolicyHandler,
  EvmTimeWindowSignaturePolicyHandler,
} from "./policies/time-window.js";
import type {
  EvmPolicyReservationInput,
  EvmPolicyReservationPlan,
  EvmPolicyStateChange,
  EvmPolicyStateInput,
  EvmPolicyStateSeed,
  ReserveEvmPoliciesResult,
} from "./types.js";

type SuccessfulEvmExecutionReceipt = Extract<EvmExecutionReceipt, { readonly success: true }>;
type EvmPolicyType = EvmSessionKeyPolicy["type"];
export type EvmPolicyCardinality = "singleton" | "repeatable";

type StatelessPolicyHandler<Policy extends EvmSessionKeyPolicy, Context, Error> = {
  readonly type: Policy["type"];
  readonly evaluate: (policy: Policy, context: Context) => Effect.Effect<EvmPolicyDecision, Error>;
};

type StatefulExecutionPolicyHandler<Policy extends EvmSessionKeyPolicy, State, Reservation> = {
  readonly type: Policy["type"];
  readonly stateSchema: Schema.Codec<State, unknown, never, never>;
  readonly reservationSchema: Schema.Codec<Reservation, unknown, never, never>;
  readonly initialStates: (
    policy: Policy,
    context: EvmIntentContext,
  ) => Effect.Effect<ReadonlyMap<string, State>, EvmPolicyError>;
  readonly evaluate: (
    policy: Policy,
    context: EvmIntentContext,
  ) => Effect.Effect<EvmPolicyDecision, EvmPolicyError>;
  readonly reserve: (
    policy: Policy,
    context: EvmIntentContext,
    states: ReadonlyMap<string, State>,
  ) => Effect.Effect<
    {
      readonly decision: EvmPolicyDecision;
      readonly states: ReadonlyMap<string, State>;
      readonly reservations: ReadonlyMap<string, Reservation>;
    },
    EvmPolicyError
  >;
  readonly settle: (
    policy: Policy,
    states: ReadonlyMap<string, State>,
    reservations: ReadonlyMap<string, Reservation>,
    result: SuccessfulEvmExecutionReceipt,
  ) => Effect.Effect<ReadonlyMap<string, State>, EvmPolicyError>;
  readonly release: (
    policy: Policy,
    states: ReadonlyMap<string, State>,
    reservations: ReadonlyMap<string, Reservation>,
  ) => Effect.Effect<ReadonlyMap<string, State>, EvmPolicyError>;
};

export type EvmExecutionPolicyOperation =
  | { readonly kind: "not-applicable" }
  | {
      readonly kind: "stateless";
      readonly evaluate: (
        policy: EvmSessionKeyPolicy,
        context: EvmIntentContext,
      ) => Effect.Effect<EvmPolicyDecision, EvmPolicyError>;
    }
  | {
      readonly kind: "stateful";
      readonly evaluate: (
        policy: EvmSessionKeyPolicy,
        context: EvmIntentContext,
      ) => Effect.Effect<EvmPolicyDecision, EvmPolicyError>;
      readonly getStateSeeds: (
        policy: EvmSessionKeyPolicy,
        context: EvmIntentContext,
      ) => Effect.Effect<ReadonlyArray<EvmPolicyStateSeed>, EvmPolicyError>;
      readonly reserve: (
        policy: EvmSessionKeyPolicy,
        context: EvmIntentContext,
        states: ReadonlyArray<EvmPolicyStateInput>,
      ) => Effect.Effect<ReserveEvmPoliciesResult, EvmPolicyError>;
      readonly settle: (
        policy: EvmSessionKeyPolicy,
        states: ReadonlyArray<EvmPolicyStateInput>,
        reservations: ReadonlyArray<EvmPolicyReservationInput>,
        result: SuccessfulEvmExecutionReceipt,
      ) => Effect.Effect<ReadonlyArray<EvmPolicyStateChange>, EvmPolicyError>;
      readonly release: (
        policy: EvmSessionKeyPolicy,
        states: ReadonlyArray<EvmPolicyStateInput>,
        reservations: ReadonlyArray<EvmPolicyReservationInput>,
      ) => Effect.Effect<ReadonlyArray<EvmPolicyStateChange>, EvmPolicyError>;
    };

export type EvmSignaturePolicyOperation =
  | { readonly kind: "not-applicable" }
  | {
      readonly kind: "stateless";
      readonly grantsAccess: boolean;
      readonly evaluate: (
        policy: EvmSessionKeyPolicy,
        context: EvmSignatureContext,
      ) => Effect.Effect<EvmPolicyDecision, EvmPolicyError>;
    };

export type EvmPolicyDefinition<Type extends EvmPolicyType = EvmPolicyType> = {
  readonly type: Type;
  readonly applicability: PolicyApplicability;
  readonly cardinality: EvmPolicyCardinality;
  readonly priority: number;
  readonly execution: EvmExecutionPolicyOperation;
  readonly signature: EvmSignaturePolicyOperation;
};

type EvmPolicyRegistry = {
  readonly [Type in EvmPolicyType]: EvmPolicyDefinition<Type>;
};

export const notApplicable = { kind: "not-applicable" } as const;

const getRegisteredPolicy = <Policy extends EvmSessionKeyPolicy>(
  handler: { readonly type: Policy["type"] },
  policy: EvmSessionKeyPolicy,
): Policy => {
  if (handler.type !== policy.type) {
    throw new Error(`Policy registry mismatch: expected ${handler.type}, received ${policy.type}`);
  }

  // The protocol union has one policy shape per discriminator. Registry lookup
  // guarantees this equality before the generic runtime adapter is entered.
  return policy as Policy;
};

const decodeStates = Effect.fn("evm.policy.registry.decode-states")(function* <State>(
  policy: EvmSessionKeyPolicy,
  states: ReadonlyArray<EvmPolicyStateInput>,
  stateSchema: Schema.Codec<State, unknown, never, never>,
) {
  const decoded = new Map<string, State>();
  for (const state of states) {
    if (state.policyId !== policy.id) continue;
    decoded.set(
      state.stateKey,
      yield* Schema.decodeUnknownEffect(stateSchema)(state.data).pipe(
        Effect.mapError(
          (cause) =>
            new EvmPolicyError({
              code: "INVALID_POLICY_STATE",
              policyId: policy.id,
              cause,
            }),
        ),
      ),
    );
  }
  return decoded;
});

const decodeReservations = Effect.fn("evm.policy.registry.decode-reservations")(function* <
  Reservation,
>(
  policy: EvmSessionKeyPolicy,
  reservations: ReadonlyArray<EvmPolicyReservationInput>,
  reservationSchema: Schema.Codec<Reservation, unknown, never, never>,
) {
  const decoded = new Map<string, Reservation>();
  for (const reservation of reservations) {
    if (reservation.policyId !== policy.id) continue;
    decoded.set(
      reservation.stateKey,
      yield* Schema.decodeUnknownEffect(reservationSchema)(reservation.data).pipe(
        Effect.mapError(
          (cause) =>
            new EvmPolicyError({
              code: "INVALID_POLICY_RESERVATION",
              policyId: policy.id,
              cause,
            }),
        ),
      ),
    );
  }
  return decoded;
});

const encodeStates = Effect.fn("evm.policy.registry.encode-states")(function* <State>(
  policy: EvmSessionKeyPolicy,
  states: ReadonlyMap<string, State>,
  stateSchema: Schema.Codec<State, unknown, never, never>,
) {
  const changes: Array<EvmPolicyStateChange> = [];
  for (const [stateKey, state] of states) {
    const data = yield* Schema.encodeEffect(stateSchema)(state).pipe(
      Effect.mapError(
        (cause) =>
          new EvmPolicyError({
            code: "INVALID_POLICY_STATE",
            policyId: policy.id,
            cause,
          }),
      ),
    );
    changes.push({
      policyId: policy.id,
      stateKey,
      stateVersion: policy.version,
      data: data as SessionKeyPolicyState["data"],
    });
  }
  return changes;
});

const encodeReservations = Effect.fn("evm.policy.registry.encode-reservations")(function* <
  Reservation,
>(
  policy: EvmSessionKeyPolicy,
  reservations: ReadonlyMap<string, Reservation>,
  reservationSchema: Schema.Codec<Reservation, unknown, never, never>,
) {
  const plans: Array<EvmPolicyReservationPlan> = [];
  for (const [stateKey, reservation] of reservations) {
    const data = yield* Schema.encodeEffect(reservationSchema)(reservation).pipe(
      Effect.mapError(
        (cause) =>
          new EvmPolicyError({
            code: "INVALID_POLICY_RESERVATION",
            policyId: policy.id,
            cause,
          }),
      ),
    );
    plans.push({
      policyId: policy.id,
      stateKey,
      reservationVersion: policy.version,
      data: data as SessionKeyPolicyReservation["data"],
    });
  }
  return plans;
});

export const executionStateless = <
  Policy extends EvmSessionKeyPolicy,
  Error extends EvmPolicyError = never,
>(
  handler: StatelessPolicyHandler<Policy, EvmIntentContext, Error>,
): EvmExecutionPolicyOperation => ({
  kind: "stateless",
  evaluate: (policy, context) =>
    Effect.sync(() => getRegisteredPolicy(handler, policy)).pipe(
      Effect.flatMap((registeredPolicy) => handler.evaluate(registeredPolicy, context)),
    ),
});

export const executionStateful = <Policy extends EvmSessionKeyPolicy, State, Reservation>(
  handler: StatefulExecutionPolicyHandler<Policy, State, Reservation>,
): EvmExecutionPolicyOperation => ({
  kind: "stateful",
  evaluate: (policy, context) =>
    Effect.sync(() => getRegisteredPolicy(handler, policy)).pipe(
      Effect.flatMap((registeredPolicy) => handler.evaluate(registeredPolicy, context)),
    ),
  getStateSeeds: (policy, context) =>
    Effect.sync(() => getRegisteredPolicy(handler, policy)).pipe(
      Effect.flatMap((registeredPolicy) => handler.initialStates(registeredPolicy, context)),
      Effect.flatMap((states) => encodeStates(policy, states, handler.stateSchema)),
    ),
  reserve: Effect.fn("evm.policy.registry.reserve")(function* (policy, context, stateInputs) {
    const registeredPolicy = getRegisteredPolicy(handler, policy);
    const states = yield* decodeStates(registeredPolicy, stateInputs, handler.stateSchema);
    const result = yield* handler.reserve(registeredPolicy, context, states);
    if (!result.decision.allowed) {
      return { decision: result.decision, stateChanges: [], reservations: [] };
    }

    return {
      decision: result.decision,
      stateChanges: yield* encodeStates(registeredPolicy, result.states, handler.stateSchema),
      reservations: yield* encodeReservations(
        registeredPolicy,
        result.reservations,
        handler.reservationSchema,
      ),
    };
  }),
  settle: Effect.fn("evm.policy.registry.settle")(
    function* (policy, stateInputs, reservationInputs, result) {
      const registeredPolicy = getRegisteredPolicy(handler, policy);
      const states = yield* decodeStates(registeredPolicy, stateInputs, handler.stateSchema);
      const reservations = yield* decodeReservations(
        registeredPolicy,
        reservationInputs,
        handler.reservationSchema,
      );
      const settled = yield* handler.settle(registeredPolicy, states, reservations, result);
      return yield* encodeStates(registeredPolicy, settled, handler.stateSchema);
    },
  ),
  release: Effect.fn("evm.policy.registry.release")(
    function* (policy, stateInputs, reservationInputs) {
      const registeredPolicy = getRegisteredPolicy(handler, policy);
      const states = yield* decodeStates(registeredPolicy, stateInputs, handler.stateSchema);
      const reservations = yield* decodeReservations(
        registeredPolicy,
        reservationInputs,
        handler.reservationSchema,
      );
      const released = yield* handler.release(registeredPolicy, states, reservations);
      return yield* encodeStates(registeredPolicy, released, handler.stateSchema);
    },
  ),
});

export const signatureStateless = <
  Policy extends EvmSessionKeyPolicy,
  Error extends EvmPolicyError = never,
>(
  handler: StatelessPolicyHandler<Policy, EvmSignatureContext, Error>,
  options: { readonly grantsAccess: boolean },
): EvmSignaturePolicyOperation => ({
  kind: "stateless",
  grantsAccess: options.grantsAccess,
  evaluate: (policy, context) =>
    Effect.sync(() => getRegisteredPolicy(handler, policy)).pipe(
      Effect.flatMap((registeredPolicy) => handler.evaluate(registeredPolicy, context)),
    ),
});

const chainAllowlistHandler = new EvmChainAllowlistPolicyHandler();
const chainAllowlistSignatureHandler = new EvmChainAllowlistSignaturePolicyHandler();
const gasBudgetHandler = new EvmGasBudgetPolicyHandler();
const nativeSpendLimitHandler = new EvmNativeSpendLimitPolicyHandler();
const timeWindowHandler = new EvmTimeWindowPolicyHandler();
const timeWindowSignatureHandler = new EvmTimeWindowSignaturePolicyHandler();
const signatureHandler = new EvmSignaturePolicyHandler();

export const evmPolicyRegistry = {
  "evm.chain-allowlist": {
    type: "evm.chain-allowlist",
    applicability: "both",
    cardinality: "singleton",
    priority: 200,
    execution: executionStateless(chainAllowlistHandler),
    signature: signatureStateless(chainAllowlistSignatureHandler, { grantsAccess: false }),
  },
  "evm.gas-budget": {
    type: "evm.gas-budget",
    applicability: "execution",
    cardinality: "singleton",
    priority: 400,
    execution: executionStateful(gasBudgetHandler),
    signature: notApplicable,
  },
  "evm.native-spend-limit": {
    type: "evm.native-spend-limit",
    applicability: "execution",
    cardinality: "singleton",
    priority: 500,
    execution: executionStateful(nativeSpendLimitHandler),
    signature: notApplicable,
  },
  "evm.time-window": {
    type: "evm.time-window",
    applicability: "both",
    cardinality: "singleton",
    priority: 100,
    execution: executionStateless(timeWindowHandler),
    signature: signatureStateless(timeWindowSignatureHandler, { grantsAccess: false }),
  },
  "evm.signature": {
    type: "evm.signature",
    applicability: "signature",
    cardinality: "singleton",
    priority: 600,
    execution: notApplicable,
    signature: signatureStateless(signatureHandler, { grantsAccess: true }),
  },
} satisfies EvmPolicyRegistry;

export const getEvmPolicyDefinition = (type: EvmPolicyType): EvmPolicyDefinition =>
  evmPolicyRegistry[type];

export const materializeEvmPolicy = (
  policy: CreateEvmSessionKeyPolicy,
  id: EvmSessionKeyPolicy["id"],
): EvmSessionKeyPolicy => {
  const definition = getEvmPolicyDefinition(policy.type);

  // The exhaustive registry couples each policy discriminator to its code-owned
  // applicability. The protocol union validates the public fields before this
  // trusted materialization boundary.
  return { ...policy, id, appliesTo: definition.applicability } as EvmSessionKeyPolicy;
};

export const findEvmPolicyCardinalityViolation = (
  policies: ReadonlyArray<CreateEvmSessionKeyPolicy>,
): EvmPolicyType | undefined => {
  const seen = new Set<EvmPolicyType>();
  for (const policy of policies) {
    const definition = getEvmPolicyDefinition(policy.type);
    if (definition.cardinality === "repeatable") continue;
    if (seen.has(policy.type)) return policy.type;
    seen.add(policy.type);
  }
  return undefined;
};

export const getEvmPolicyDefinitionFor = (policy: EvmSessionKeyPolicy): EvmPolicyDefinition => {
  const definition = getEvmPolicyDefinition(policy.type);
  if (definition.applicability !== policy.appliesTo) {
    throw new Error(
      `Policy registry applicability mismatch: expected ${definition.applicability}, received ${policy.appliesTo}`,
    );
  }
  return definition;
};

export const orderEvmPolicies = (policies: ReadonlyArray<EvmSessionKeyPolicy>) =>
  policies.toSorted((left, right) => {
    const priorityDifference =
      getEvmPolicyDefinitionFor(left).priority - getEvmPolicyDefinitionFor(right).priority;
    return priorityDifference === 0 ? left.id.localeCompare(right.id) : priorityDifference;
  });
