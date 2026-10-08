import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";

import { EvmNativeSpendLimitPolicy, SupportedEvmChainId } from "@namera-ai/protocol";

import { Evm } from "../../../src/index.js";
import { chainId, policyId, policy, lifetimeStateKey } from "../../fixtures/policy-budget.js";
import { makeContext, receipt } from "../../fixtures/policy-context.js";

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
