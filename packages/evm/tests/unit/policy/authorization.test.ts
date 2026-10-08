import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";

import {
  EvmChainAllowlistPolicy,
  SupportedEvmChainId,
  type EvmTimeWindowPolicy,
} from "@namera-ai/protocol";

import { Evm } from "../../../src/index.js";
import {
  chainId,
  policyId,
  timeWindowPolicyId,
  chainAllowlistPolicyId,
  policy,
  chainAllowlistPolicy,
} from "../../fixtures/policy-budget.js";
import { makeContext } from "../../fixtures/policy-context.js";

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
    expect(evm.policy.authorizationDeadline({ policies: [timeWindow], latest })).toEqual(
      timeWindow.expiresAt,
    );
    expect(evm.policy.authorizationDeadline({ policies: [], latest })).toEqual(latest);
    const earlierDeadline = DateTime.fromEpochSeconds(1);
    expect(
      evm.policy.authorizationDeadline({ policies: [timeWindow], latest: earlierDeadline }),
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
