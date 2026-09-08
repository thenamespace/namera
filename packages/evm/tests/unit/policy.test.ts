import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";

import {
  Bytes32,
  EvmChainAllowlistPolicy,
  EvmGasBudgetPolicy,
  EvmNativeSpendLimitPolicy,
  EthereumAddress,
  Hex,
  PolicyId,
  SupportedEvmChainId,
  TransactionHash,
  UserOperationHash,
  type EvmIntentContext,
  type EvmTimeWindowPolicy,
} from "@namera-ai/protocol";

import { Evm } from "../../src/index.js";

const chainId = Schema.decodeSync(SupportedEvmChainId)("eip155:1");
const policyId = Schema.decodeSync(PolicyId)("01900000-0000-7000-8000-000000000001");
const timeWindowPolicyId = Schema.decodeSync(PolicyId)("01900000-0000-7000-8000-000000000002");
const chainAllowlistPolicyId = Schema.decodeSync(PolicyId)("01900000-0000-7000-8000-000000000003");
const gasBudgetPolicyId = Schema.decodeSync(PolicyId)("01900000-0000-7000-8000-000000000004");
const address = EthereumAddress.make("0x1111111111111111111111111111111111111111");

const policy = {
  id: policyId,
  type: "evm.native-spend-limit",
  version: 1,
  appliesTo: "execution",
  limits: [{ chainId, period: "lifetime", maxAmount: 10n }],
} satisfies EvmNativeSpendLimitPolicy;
const lifetimeStateKey = `${chainId}:lifetime`;
const chainAllowlistPolicy = {
  id: chainAllowlistPolicyId,
  type: "evm.chain-allowlist",
  version: 1,
  appliesTo: "both",
  chainIds: [chainId],
} satisfies EvmChainAllowlistPolicy;
const gasBudgetPolicy = {
  id: gasBudgetPolicyId,
  type: "evm.gas-budget",
  version: 1,
  appliesTo: "execution",
  budgets: [
    { chainId, period: "day", maxCost: 20n },
    { chainId, period: "lifetime", maxCost: 100n },
  ],
} satisfies EvmGasBudgetPolicy;

const makeContext = (
  value: bigint,
  timestamp: DateTime.Utc = DateTime.fromEpochSeconds(1),
): EvmIntentContext => ({
  version: 1,
  namespace: "eip155",
  chainId,
  account: address,
  block: {
    number: 1n,
    hash: Bytes32.make(`0x${"1".repeat(64)}`),
    timestamp,
  },
  calls: [{ to: address, value, data: Hex.make("0x") }],
  userOperation: {
    nonce: 0n,
    gas: {
      callGasLimit: 1n,
      verificationGasLimit: 1n,
      preVerificationGas: 1n,
      paymasterVerificationGasLimit: 0n,
      paymasterPostOpGasLimit: 0n,
      maxFeePerGas: 1n,
      maxPriorityFeePerGas: 1n,
    },
    paymaster: null,
  },
  simulation: {
    userOperation: {
      source: "eth_estimateUserOperationGas",
      callGasLimit: 1n,
      verificationGasLimit: 1n,
      preVerificationGas: 1n,
      maxFeePerGas: 1n,
      maxPriorityFeePerGas: 1n,
    },
    calls: {
      source: "viem.simulateCalls",
      results: [{ status: "success", returnData: Hex.make("0x"), gasUsed: 1n }],
      assetChanges: [],
      transfers: [],
    },
  },
});

const receipt = {
  version: 1,
  namespace: "eip155",
  chainId,
  userOperationHash: UserOperationHash.make(`0x${"2".repeat(64)}`),
  transactionHash: TransactionHash.make(`0x${"3".repeat(64)}`),
  blockHash: Bytes32.make(`0x${"4".repeat(64)}`),
  blockNumber: 2n,
  sender: address,
  nonce: 0n,
  entryPoint: EthereumAddress.make("0x0000000071727de22e5e9d8baf0edac6f37da032"),
  paymaster: null,
  actualGasCost: 1n,
  actualGasUsed: 1n,
  success: true,
  reason: null,
} as const;

it("accepts multiple periods per chain but rejects duplicate chain-period limits", () => {
  expect(
    Schema.is(EvmNativeSpendLimitPolicy)({
      ...policy,
      limits: [
        { chainId, period: "day", maxAmount: 1n },
        { chainId, period: "lifetime", maxAmount: 10n },
      ],
    }),
  ).toBe(true);
  expect(
    Schema.is(EvmNativeSpendLimitPolicy)({
      ...policy,
      limits: [
        { chainId, period: "day", maxAmount: 1n },
        { chainId, period: "day", maxAmount: 2n },
      ],
    }),
  ).toBe(false);
});

it("requires a non-empty unique chain allowlist", () => {
  expect(Schema.is(EvmChainAllowlistPolicy)(chainAllowlistPolicy)).toBe(true);
  expect(Schema.is(EvmChainAllowlistPolicy)({ ...chainAllowlistPolicy, chainIds: [] })).toBe(false);
  expect(
    Schema.is(EvmChainAllowlistPolicy)({ ...chainAllowlistPolicy, chainIds: [chainId, chainId] }),
  ).toBe(false);
});

it.effect("allows only configured execution chains", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const allowed = yield* evm.policy.evaluate({
      policies: [chainAllowlistPolicy],
      context: makeContext(0n),
    });
    const denied = yield* evm.policy.evaluate({
      policies: [chainAllowlistPolicy],
      context: {
        ...makeContext(0n),
        chainId: Schema.decodeSync(SupportedEvmChainId)("eip155:10"),
      },
    });

    expect(allowed).toEqual({ allowed: true });
    expect(denied).toEqual({
      allowed: false,
      policyId: chainAllowlistPolicyId,
      code: "CHAIN_NOT_ALLOWED",
    });
  }).pipe(Effect.provide(Evm.testLayer)),
);

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

it.effect("reserves, settles, and releases native spend", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const reserved = yield* evm.policy.reserve({
      policies: [policy],
      context: makeContext(4n),
      states: [],
    });

    expect(reserved.decision).toEqual({ allowed: true });
    expect(reserved.stateChanges).toEqual([
      {
        policyId,
        stateKey: lifetimeStateKey,
        stateVersion: 1,
        data: { version: 1, spent: "0", reserved: "4" },
      },
    ]);
    expect(reserved.reservations).toEqual([
      {
        policyId,
        stateKey: lifetimeStateKey,
        reservationVersion: 1,
        data: { version: 1, amount: "4" },
      },
    ]);

    const state = reserved.stateChanges[0];
    const reservation = reserved.reservations[0];
    if (state === undefined || reservation === undefined) {
      return yield* Effect.die("Expected native-spend reservation state");
    }
    const settled = yield* evm.policy.settle({
      policies: [policy],
      states: [state],
      reservations: [reservation],
      result: receipt,
    });
    expect(settled[0]?.data).toEqual({ version: 1, spent: "4", reserved: "0" });

    const released = yield* evm.policy.release({
      policies: [policy],
      states: [state],
      reservations: [reservation],
    });
    expect(released[0]?.data).toEqual({ version: 1, spent: "0", reserved: "0" });
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("derives initial state from the registered policy handler", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const seeds = yield* evm.policy.getStateSeeds({
      policies: [policy],
      context: makeContext(1n),
    });

    expect(seeds).toEqual([
      {
        policyId,
        stateKey: lifetimeStateKey,
        stateVersion: 1,
        data: { version: 1, spent: "0", reserved: "0" },
      },
    ]);
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("reserves every configured fixed-window and lifetime allowance atomically", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const timestamp = DateTime.makeUnsafe("2026-08-19T12:34:56Z");
    const dailyStateKey = `${chainId}:day:${DateTime.toEpochMillis(
      DateTime.makeUnsafe("2026-08-19T00:00:00Z"),
    )}`;
    const combinedPolicy = {
      ...policy,
      limits: [
        { chainId, period: "operation", maxAmount: 5n },
        { chainId, period: "day", maxAmount: 8n },
        { chainId, period: "lifetime", maxAmount: 20n },
      ],
    } satisfies EvmNativeSpendLimitPolicy;

    const reserved = yield* evm.policy.reserve({
      policies: [combinedPolicy],
      context: makeContext(4n, timestamp),
      states: [
        {
          policyId,
          stateKey: dailyStateKey,
          data: { version: 1, spent: "2", reserved: "1" },
        },
        {
          policyId,
          stateKey: lifetimeStateKey,
          data: { version: 1, spent: "10", reserved: "1" },
        },
      ],
    });

    expect(reserved.decision).toEqual({ allowed: true });
    expect(reserved.stateChanges).toEqual([
      {
        policyId,
        stateKey: dailyStateKey,
        stateVersion: 1,
        data: { version: 1, spent: "2", reserved: "5" },
      },
      {
        policyId,
        stateKey: lifetimeStateKey,
        stateVersion: 1,
        data: { version: 1, spent: "10", reserved: "5" },
      },
    ]);
    expect(reserved.reservations.map(({ stateKey }) => stateKey)).toEqual([
      dailyStateKey,
      lifetimeStateKey,
    ]);
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("uses a new state key when a fixed UTC period resets", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const dailyPolicy = {
      ...policy,
      limits: [{ chainId, period: "day", maxAmount: 5n }],
    } satisfies EvmNativeSpendLimitPolicy;
    const previousStateKey = `${chainId}:day:${DateTime.toEpochMillis(
      DateTime.makeUnsafe("2026-08-18T00:00:00Z"),
    )}`;
    const currentStateKey = `${chainId}:day:${DateTime.toEpochMillis(
      DateTime.makeUnsafe("2026-08-19T00:00:00Z"),
    )}`;

    const reserved = yield* evm.policy.reserve({
      policies: [dailyPolicy],
      context: makeContext(3n, DateTime.makeUnsafe("2026-08-19T00:00:00Z")),
      states: [
        {
          policyId,
          stateKey: previousStateKey,
          data: { version: 1, spent: "5", reserved: "0" },
        },
      ],
    });

    expect(reserved.decision).toEqual({ allowed: true });
    expect(reserved.stateChanges).toEqual([
      {
        policyId,
        stateKey: currentStateKey,
        stateVersion: 1,
        data: { version: 1, spent: "0", reserved: "3" },
      },
    ]);
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("starts weekly native allowances on Monday at 00:00 UTC", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const weeklyPolicy = {
      ...policy,
      limits: [{ chainId, period: "week", maxAmount: 5n }],
    } satisfies EvmNativeSpendLimitPolicy;
    const expectedStateKey = `${chainId}:week:${DateTime.toEpochMillis(
      DateTime.makeUnsafe("2026-08-17T00:00:00Z"),
    )}`;

    const seeds = yield* evm.policy.getStateSeeds({
      policies: [weeklyPolicy],
      context: makeContext(1n, DateTime.makeUnsafe("2026-08-19T12:00:00Z")),
    });

    expect(seeds.map(({ stateKey }) => stateKey)).toEqual([expectedStateKey]);
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("enforces a per-operation allowance without creating durable state", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const operationPolicy = {
      ...policy,
      limits: [{ chainId, period: "operation", maxAmount: 3n }],
    } satisfies EvmNativeSpendLimitPolicy;

    const allowed = yield* evm.policy.reserve({
      policies: [operationPolicy],
      context: makeContext(3n),
      states: [],
    });
    const denied = yield* evm.policy.reserve({
      policies: [operationPolicy],
      context: makeContext(4n),
      states: [],
    });

    expect(allowed).toEqual({
      decision: { allowed: true },
      stateChanges: [],
      reservations: [],
    });
    expect(denied.decision).toEqual({
      allowed: false,
      policyId,
      code: "NATIVE_SPEND_LIMIT_EXCEEDED",
    });
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("denies native spend when committed and reserved value exhaust the limit", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const result = yield* evm.policy.reserve({
      policies: [policy],
      context: makeContext(4n),
      states: [
        {
          policyId,
          stateKey: lifetimeStateKey,
          data: { version: 1, spent: "5", reserved: "2" },
        },
      ],
    });

    expect(result).toEqual({
      decision: { allowed: false, policyId, code: "NATIVE_SPEND_LIMIT_EXCEEDED" },
      stateChanges: [],
      reservations: [],
    });
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("rejects malformed persisted policy state", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const error = yield* Effect.flip(
      evm.policy.reserve({
        policies: [policy],
        context: makeContext(1n),
        states: [
          {
            policyId,
            stateKey: lifetimeStateKey,
            data: { version: 1, spent: "invalid", reserved: "0" },
          },
        ],
      }),
    );

    expect(error.code).toBe("INVALID_POLICY_STATE");
    expect(error.policyId).toBe(policyId);
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("rejects a persisted reservation with an invalid version", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const error = yield* Effect.flip(
      evm.policy.settle({
        policies: [policy],
        states: [
          {
            policyId,
            stateKey: lifetimeStateKey,
            data: { version: 1, spent: "0", reserved: "1" },
          },
        ],
        reservations: [
          {
            policyId,
            stateKey: lifetimeStateKey,
            data: { version: 2, amount: "1" },
          },
        ],
        result: receipt,
      }),
    );

    expect(error.code).toBe("INVALID_POLICY_RESERVATION");
    expect(error.policyId).toBe(policyId);
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("denies native spend on a chain without a configured limit", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const result = yield* evm.policy.evaluate({
      policies: [policy],
      context: { ...makeContext(1n), chainId: Schema.decodeSync(SupportedEvmChainId)("eip155:10") },
    });

    expect(result).toEqual({
      allowed: false,
      policyId,
      code: "NATIVE_SPEND_CHAIN_NOT_CONFIGURED",
    });
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("allows zero-value calls on a chain without a configured limit", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const context = {
      ...makeContext(0n),
      chainId: Schema.decodeSync(SupportedEvmChainId)("eip155:10"),
    };

    const evaluated = yield* evm.policy.evaluate({ policies: [policy], context });
    const reserved = yield* evm.policy.reserve({ policies: [policy], context, states: [] });

    expect(evaluated).toEqual({ allowed: true });
    expect(reserved).toEqual({
      decision: { allowed: true },
      stateChanges: [],
      reservations: [],
    });
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("treats time-window expiration as an exclusive boundary", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const timeWindow = {
      id: policyId,
      type: "evm.time-window",
      version: 1,
      appliesTo: "both",
      startsAt: DateTime.fromEpochSeconds(1),
      expiresAt: DateTime.fromEpochSeconds(2),
    } satisfies EvmTimeWindowPolicy;

    const allowed = yield* evm.policy.evaluate({
      policies: [timeWindow],
      context: makeContext(0n),
    });
    const expired = yield* evm.policy.evaluate({
      policies: [timeWindow],
      context: {
        ...makeContext(0n),
        block: { ...makeContext(0n).block, timestamp: DateTime.fromEpochSeconds(2) },
      },
    });

    expect(allowed).toEqual({ allowed: true });
    expect(expired).toEqual({ allowed: false, policyId, code: "TIME_WINDOW_EXPIRED" });
    const latest = DateTime.fromEpochSeconds(300);
    expect(evm.policy.executionDeadline({ policies: [timeWindow], latest })).toEqual(
      timeWindow.expiresAt,
    );
    expect(evm.policy.executionDeadline({ policies: [], latest })).toEqual(latest);
    const earlierDeadline = DateTime.fromEpochSeconds(1);
    expect(
      evm.policy.executionDeadline({ policies: [timeWindow], latest: earlierDeadline }),
    ).toEqual(earlierDeadline);
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("evaluates policy denials in registry priority order", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const timeWindow = {
      id: timeWindowPolicyId,
      type: "evm.time-window",
      version: 1,
      appliesTo: "both",
      startsAt: DateTime.fromEpochSeconds(0),
      expiresAt: DateTime.fromEpochSeconds(1),
    } satisfies EvmTimeWindowPolicy;
    const context = makeContext(11n);

    const first = yield* evm.policy.evaluate({ policies: [policy, timeWindow], context });
    const second = yield* evm.policy.evaluate({ policies: [timeWindow, policy], context });

    const expected = {
      allowed: false,
      policyId: timeWindowPolicyId,
      code: "TIME_WINDOW_EXPIRED",
    } as const;
    expect(first).toEqual(expected);
    expect(second).toEqual(expected);
  }).pipe(Effect.provide(Evm.testLayer)),
);
