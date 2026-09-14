import { expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import {
  EthereumAddress,
  Hex,
  PolicyId,
  SupportedEvmChainId,
  CreateEvmContractFunctionsPolicy,
  CreateEvmTokenSpendPolicy,
  type EvmCallAccessPolicy,
  type EvmTokenSpendPolicy,
} from "@namera-ai/protocol";
import { encodeFunctionData, erc20Abi } from "viem";

import { makeEvmPolicyService } from "../../../src/policy/service.js";
import { makeContext, receipt } from "../../fixtures/policy-context.js";

const engine = makeEvmPolicyService();
const target = EthereumAddress.make("0x2222222222222222222222222222222222222222");
const other = EthereumAddress.make("0x3333333333333333333333333333333333333333");
const id = PolicyId.make("01900000-0000-7000-8000-000000000001");
const transfer = (amount: bigint) =>
  Hex.make(encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [other, amount] }));
const call = (amount: bigint) => ({ to: target, value: 0n, data: transfer(amount) });
const context = (amount: bigint) => ({ ...makeContext(0n), calls: [call(amount)] });
const token: EvmTokenSpendPolicy = {
  id,
  version: 1,
  type: "evm.erc20-token-transfer",
  appliesTo: "execution",
  address: target,
  allowance: 10n,
};

it.effect("checks every batch call for each call-access variant", () =>
  Effect.gen(function* () {
    const policies: ReadonlyArray<EvmCallAccessPolicy> = [
      { id, version: 1, appliesTo: "execution", type: "evm.contract-access", address: target },
      {
        id,
        version: 1,
        appliesTo: "execution",
        type: "evm.functions-on-contract",
        address: target,
        functions: [Hex.make("0xa9059cbb")],
      },
      {
        id,
        version: 1,
        appliesTo: "execution",
        type: "evm.functions-on-all-contracts",
        functions: [Hex.make("0xa9059cbb")],
      },
      {
        id,
        version: 1,
        appliesTo: "execution",
        type: "evm.account-functions",
        functions: [Hex.make("0xa9059cbb")],
      },
    ];
    for (const policy of policies) {
      const to = policy.type === "evm.account-functions" ? makeContext(0n).account : target;
      const allowed = { ...context(1n), calls: [{ ...call(1n), to }] };
      expect(yield* engine.evaluate({ policies: [policy], context: allowed })).toEqual({
        allowed: true,
      });
      const deniedCall =
        policy.type === "evm.contract-access"
          ? { ...call(1n), to: other }
          : { ...call(1n), to, data: Hex.make("0xdeadbeef") };
      expect(
        yield* engine.evaluate({
          policies: [policy],
          context: { ...allowed, calls: [...allowed.calls, deniedCall] },
        }),
      ).toMatchObject({ allowed: false, code: "CALL_NOT_ALLOWED" });
    }
  }),
);

it.effect("does not let a wildcard selector reach the account itself", () =>
  Effect.gen(function* () {
    const policy: EvmCallAccessPolicy = {
      id,
      version: 1,
      appliesTo: "execution",
      type: "evm.functions-on-all-contracts",
      functions: [Hex.make("0xa9059cbb")],
    };
    expect(
      yield* engine.evaluate({
        policies: [policy],
        context: { ...context(1n), calls: [{ ...call(1n), to: makeContext(0n).account }] },
      }),
    ).toMatchObject({ allowed: false });
  }),
);

it.effect("reserves token spend across pending operations and settles or releases it", () =>
  Effect.gen(function* () {
    const reserved = yield* engine.reserve({ policies: [token], context: context(6n), states: [] });
    expect(reserved.decision).toEqual({ allowed: true });
    expect(reserved.stateChanges[0]?.data).toEqual({ version: 1, spent: "0", reserved: "6" });
    expect(
      (yield* engine.reserve({
        policies: [token],
        context: context(5n),
        states: reserved.stateChanges,
      })).decision,
    ).toMatchObject({ allowed: false, code: "TOKEN_SPEND_LIMIT_EXCEEDED" });
    expect(
      (yield* engine.reserve({
        policies: [token],
        context: context(4n),
        states: reserved.stateChanges,
      })).decision,
    ).toEqual({ allowed: true });
    const settled = yield* engine.settle({
      policies: [token],
      states: reserved.stateChanges,
      reservations: reserved.reservations,
      result: receipt,
    });
    expect(settled[0]?.data).toEqual({ version: 1, spent: "6", reserved: "0" });
    expect(
      (yield* engine.reserve({ policies: [token], context: context(5n), states: settled }))
        .decision,
    ).toMatchObject({ allowed: false });
    const released = yield* engine.release({
      policies: [token],
      states: reserved.stateChanges,
      reservations: reserved.reservations,
    });
    expect(released[0]?.data).toEqual({ version: 1, spent: "0", reserved: "0" });
    expect(
      (yield* engine.reserve({
        policies: [token],
        context: { ...context(10n), chainId: SupportedEvmChainId.make("eip155:10") },
        states: settled,
      })).decision,
    ).toEqual({ allowed: true });
  }),
);

it.effect(
  "rejects unsupported or noncanonical token calls even when simulation reports no assets",
  () =>
    Effect.gen(function* () {
      const invalid = [
        { ...call(1n), to: other },
        { ...call(1n), value: 1n },
        { ...call(1n), data: Hex.make("0xa9059cbb") },
        { ...call(1n), data: Hex.make(`${transfer(1n)}00`) },
        {
          ...call(1n),
          data: Hex.make(
            encodeFunctionData({ abi: erc20Abi, functionName: "balanceOf", args: [other] }),
          ),
        },
        {
          ...call(1n),
          data: Hex.make(
            encodeFunctionData({
              abi: erc20Abi,
              functionName: "transferFrom",
              args: [other, target, 1n],
            }),
          ),
        },
      ];
      for (const invalidCall of invalid) {
        expect(
          yield* engine.evaluate({
            policies: [token],
            context: { ...context(1n), calls: [call(1n), invalidCall] },
          }),
        ).toMatchObject({ allowed: false, code: "TOKEN_CALL_NOT_ALLOWED" });
      }
    }),
);

it.effect("counts full approvals and wallet-owned transferFrom amounts", () =>
  Effect.gen(function* () {
    for (const data of [
      encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [other, 11n] }),
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "transferFrom",
        args: [makeContext(0n).account, other, 11n],
      }),
    ]) {
      expect(
        yield* engine.evaluate({
          policies: [token],
          context: { ...context(0n), calls: [{ ...call(0n), data: Hex.make(data) }] },
        }),
      ).toMatchObject({ allowed: false, code: "TOKEN_SPEND_LIMIT_EXCEEDED" });
    }
  }),
);

it("rejects duplicate selectors and out-of-range token allowances at the public schema", () => {
  expect(
    Schema.is(CreateEvmContractFunctionsPolicy)({
      version: 1,
      type: "evm.functions-on-contract",
      address: target,
      functions: ["0xa9059cbb", "0xA9059CBB"],
    }),
  ).toBe(false);
  expect(
    Schema.is(CreateEvmTokenSpendPolicy)({
      version: 1,
      type: token.type,
      address: target,
      allowance: -1n,
    }),
  ).toBe(false);
  expect(
    Schema.is(CreateEvmTokenSpendPolicy)({
      version: 1,
      type: token.type,
      address: target,
      allowance: 2n ** 256n,
    }),
  ).toBe(false);
});
