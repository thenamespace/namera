import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";

import {
  Bytes32,
  EthereumAddress,
  Hex,
  PolicyId,
  SupportedEvmChainId,
  TransactionHash,
  UserOperationHash,
  type EvmIntentContext,
  type EvmNativeSpendLimitPolicy,
  type EvmTimeWindowPolicy,
} from "@namera-ai/protocol";

import { Evm } from "../src/index.js";

const chainId = Schema.decodeSync(SupportedEvmChainId)("eip155:1");
const policyId = Schema.decodeSync(PolicyId)("01900000-0000-7000-8000-000000000001");
const timeWindowPolicyId = Schema.decodeSync(PolicyId)("01900000-0000-7000-8000-000000000002");
const address = EthereumAddress.make("0x1111111111111111111111111111111111111111");

const policy = {
  id: policyId,
  type: "evm.native-spend-limit",
  version: 1,
  appliesTo: "execution",
  limits: [{ chainId, maxAmount: 10n }],
} satisfies EvmNativeSpendLimitPolicy;

const makeContext = (value: bigint): EvmIntentContext => ({
  version: 1,
  namespace: "eip155",
  chainId,
  account: address,
  block: {
    number: 1n,
    hash: Bytes32.make(`0x${"1".repeat(64)}`),
    timestamp: DateTime.fromEpochSeconds(1),
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
      paymasterVerificationGasLimit: 0n,
      paymasterPostOpGasLimit: 0n,
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
        stateKey: chainId,
        stateVersion: 1,
        data: { version: 1, spent: "0", reserved: "4" },
      },
    ]);
    expect(reserved.reservations).toEqual([
      {
        policyId,
        stateKey: chainId,
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
      context: makeContext(0n),
    });

    expect(seeds).toEqual([
      {
        policyId,
        stateKey: chainId,
        stateVersion: 1,
        data: { version: 1, spent: "0", reserved: "0" },
      },
    ]);
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
          stateKey: chainId,
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
            stateKey: chainId,
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
            stateKey: chainId,
            data: { version: 1, spent: "0", reserved: "1" },
          },
        ],
        reservations: [
          {
            policyId,
            stateKey: chainId,
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
