import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";

import { EvmGasBudgetPolicy, SupportedEvmChainId } from "@namera-ai/protocol";

import { Evm } from "../../../src/index.js";
import { chainId, gasBudgetPolicyId, gasBudgetPolicy } from "../../fixtures/policy-budget.js";
import { makeContext, receipt } from "../../fixtures/policy-context.js";

it("accepts multiple gas periods per chain and rejects duplicate chain-period budgets", () => {
  expect(Schema.is(EvmGasBudgetPolicy)(gasBudgetPolicy)).toBe(true);
  expect(
    Schema.is(EvmGasBudgetPolicy)({
      ...gasBudgetPolicy,
      budgets: [
        { chainId, period: "day", maxCost: 1n },
        { chainId, period: "day", maxCost: 2n },
      ],
    }),
  ).toBe(false);
});
it.effect("reserves pessimistic gas cost and settles actual gas cost across every period", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const timestamp = DateTime.makeUnsafe("2026-08-19T12:34:56Z");
    const dailyStateKey = `${chainId}:day:${DateTime.toEpochMillis(
      DateTime.makeUnsafe("2026-08-19T00:00:00Z"),
    )}`;
    const baseContext = makeContext(0n, timestamp);
    const gasContext = {
      ...baseContext,
      simulation: {
        ...baseContext.simulation,
        userOperation: {
          source: "eth_estimateUserOperationGas" as const,
          callGasLimit: 2n,
          verificationGasLimit: 3n,
          preVerificationGas: 5n,
          maxFeePerGas: 2n,
          maxPriorityFeePerGas: 1n,
        },
      },
    };
    const generousPolicy = {
      ...gasBudgetPolicy,
      budgets: [
        { chainId, period: "day", maxCost: 100n },
        { chainId, period: "lifetime", maxCost: 200n },
      ],
    } satisfies EvmGasBudgetPolicy;

    const reserved = yield* evm.policy.reserve({
      policies: [generousPolicy],
      context: gasContext,
      states: [],
    });

    expect(reserved.decision).toEqual({ allowed: true });
    expect(reserved.stateChanges).toEqual([
      {
        policyId: gasBudgetPolicyId,
        stateKey: dailyStateKey,
        stateVersion: 1,
        data: { version: 1, spent: "0", reserved: "20" },
      },
      {
        policyId: gasBudgetPolicyId,
        stateKey: `${chainId}:lifetime`,
        stateVersion: 1,
        data: { version: 1, spent: "0", reserved: "20" },
      },
    ]);

    const settled = yield* evm.policy.settle({
      policies: [generousPolicy],
      states: reserved.stateChanges,
      reservations: reserved.reservations,
      result: { ...receipt, actualGasCost: 15n },
    });
    expect(settled.map(({ data }) => data)).toEqual([
      { version: 1, spent: "15", reserved: "0" },
      { version: 1, spent: "15", reserved: "0" },
    ]);

    const released = yield* evm.policy.release({
      policies: [generousPolicy],
      states: reserved.stateChanges,
      reservations: reserved.reservations,
    });
    expect(released.map(({ data }) => data)).toEqual([
      { version: 1, spent: "0", reserved: "0" },
      { version: 1, spent: "0", reserved: "0" },
    ]);
  }).pipe(Effect.provide(Evm.testLayer)),
);
it.effect("denies an unconfigured gas-budget chain and exhausted concurrent budget", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const dailyStateKey = `${chainId}:day:${DateTime.toEpochMillis(
      DateTime.makeUnsafe("1970-01-01T00:00:00Z"),
    )}`;
    const missingChain = yield* evm.policy.evaluate({
      policies: [gasBudgetPolicy],
      context: {
        ...makeContext(0n),
        chainId: Schema.decodeSync(SupportedEvmChainId)("eip155:10"),
      },
    });
    const exhausted = yield* evm.policy.reserve({
      policies: [gasBudgetPolicy],
      context: makeContext(0n),
      states: [
        {
          policyId: gasBudgetPolicyId,
          stateKey: dailyStateKey,
          data: { version: 1, spent: "16", reserved: "2" },
        },
      ],
    });

    expect(missingChain).toEqual({
      allowed: false,
      policyId: gasBudgetPolicyId,
      code: "GAS_BUDGET_CHAIN_NOT_CONFIGURED",
    });
    expect(exhausted).toEqual({
      decision: {
        allowed: false,
        policyId: gasBudgetPolicyId,
        code: "GAS_BUDGET_EXCEEDED",
      },
      stateChanges: [],
      reservations: [],
    });
  }).pipe(Effect.provide(Evm.testLayer)),
);
