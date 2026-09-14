import { Effect } from "effect";

import {
  EvmNativeSpendLimitPolicyState,
  EvmNativeSpendLimitPolicyReservation,
  EvmPolicyError,
  type EvmTokenSpendPolicy,
  type EvmIntentContext,
  type EvmPolicyDecision,
} from "@namera-ai/protocol";
import { decodeFunctionData, encodeFunctionData, erc20Abi } from "viem";

import { assertSafeSessionPermissions } from "../../sessions/permission-safety.js";

type State = EvmNativeSpendLimitPolicyState;
type Reservation = EvmNativeSpendLimitPolicyReservation;

// Count only canonical, direct token calls. No simulation completeness assumption:
// routers, delegate calls, permit, and unknown selectors are rejected outright.
const tokenAmount = (
  policy: EvmTokenSpendPolicy,
  context: EvmIntentContext,
): bigint | undefined => {
  let amount = 0n;
  try {
    assertSafeSessionPermissions(context.account, [
      { type: "erc20-token-transfer", address: policy.address, allowance: policy.allowance },
    ]);
    for (const call of context.calls) {
      if (call.to.toLowerCase() !== policy.address.toLowerCase() || call.value !== 0n)
        return undefined;
      const decoded = decodeFunctionData({ abi: erc20Abi, data: call.data });
      if (
        encodeFunctionData({ abi: erc20Abi, ...decoded }).toLowerCase() !== call.data.toLowerCase()
      )
        return undefined;
      switch (decoded.functionName) {
        case "transfer":
        case "approve":
          amount += decoded.args[1];
          break;
        case "transferFrom":
          if (decoded.args[0].toLowerCase() !== context.account.toLowerCase()) return undefined;
          amount += decoded.args[2];
          break;
        default:
          return undefined;
      }
    }
    return amount;
  } catch {
    return undefined;
  }
};
const decisionFor = (policy: EvmTokenSpendPolicy, amount: bigint | undefined): EvmPolicyDecision =>
  amount === undefined
    ? { allowed: false, policyId: policy.id, code: "TOKEN_CALL_NOT_ALLOWED" }
    : amount > policy.allowance
      ? { allowed: false, policyId: policy.id, code: "TOKEN_SPEND_LIMIT_EXCEEDED" }
      : { allowed: true };
const stateKey = (policy: EvmTokenSpendPolicy, context: EvmIntentContext) =>
  `${context.chainId}:${policy.address.toLowerCase()}:lifetime`;

const finishReservation = Effect.fn("evm.policy.token-spend.finish")(function* (
  policy: EvmTokenSpendPolicy,
  states: ReadonlyMap<string, State>,
  reservations: ReadonlyMap<string, Reservation>,
  spent: boolean,
) {
  const changes = new Map<string, State>();
  for (const [key, reservation] of reservations) {
    const state = states.get(key);
    if (!state || state.reserved < reservation.amount)
      return yield* new EvmPolicyError({
        code: "INVALID_POLICY_STATE",
        policyId: policy.id,
        cause: new Error("Token reservation exceeds reserved balance"),
      });
    changes.set(key, {
      version: 1,
      spent: state.spent + (spent ? reservation.amount : 0n),
      reserved: state.reserved - reservation.amount,
    });
  }
  return changes;
});

export const tokenSpendHandler = {
  type: "evm.erc20-token-transfer" as const,
  stateSchema: EvmNativeSpendLimitPolicyState,
  reservationSchema: EvmNativeSpendLimitPolicyReservation,
  evaluate: Effect.fn("evm.policy.token-spend.evaluate")(
    (policy: EvmTokenSpendPolicy, context: EvmIntentContext) =>
      Effect.succeed(decisionFor(policy, tokenAmount(policy, context))),
  ),
  initialStates: Effect.fn("evm.policy.token-spend.initial-states")(
    (policy: EvmTokenSpendPolicy, context: EvmIntentContext) =>
      Effect.succeed(
        new Map<string, State>([
          [stateKey(policy, context), { version: 1, spent: 0n, reserved: 0n }],
        ]),
      ),
  ),
  reserve: Effect.fn("evm.policy.token-spend.reserve")(
    (
      policy: EvmTokenSpendPolicy,
      context: EvmIntentContext,
      states: ReadonlyMap<string, State>,
    ) => {
      const amount = tokenAmount(policy, context);
      const decision = decisionFor(policy, amount);
      const changes = new Map<string, State>();
      const reservations = new Map<string, Reservation>();
      if (!decision.allowed || amount === undefined)
        return Effect.succeed({ decision, states: changes, reservations });
      const key = stateKey(policy, context);
      const state = states.get(key) ?? { version: 1 as const, spent: 0n, reserved: 0n };
      if (state.spent + state.reserved + amount > policy.allowance)
        return Effect.succeed({
          decision: {
            allowed: false,
            policyId: policy.id,
            code: "TOKEN_SPEND_LIMIT_EXCEEDED",
          } as EvmPolicyDecision,
          states: changes,
          reservations,
        });
      if (amount > 0n) {
        changes.set(key, { ...state, reserved: state.reserved + amount });
        reservations.set(key, { version: 1, amount });
      }
      return Effect.succeed({ decision, states: changes, reservations });
    },
  ),
  settle: (
    policy: EvmTokenSpendPolicy,
    states: ReadonlyMap<string, State>,
    reservations: ReadonlyMap<string, Reservation>,
  ) => finishReservation(policy, states, reservations, true),
  release: (
    policy: EvmTokenSpendPolicy,
    states: ReadonlyMap<string, State>,
    reservations: ReadonlyMap<string, Reservation>,
  ) => finishReservation(policy, states, reservations, false),
};
