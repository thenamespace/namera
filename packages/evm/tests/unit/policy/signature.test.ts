import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";

import {
  EvmChainAllowlistPolicy,
  EthereumAddress,
  PolicyId,
  SupportedEvmChainId,
  type EvmSignatureContext,
  type EvmSignaturePolicy,
  type EvmTimeWindowPolicy,
} from "@namera-ai/protocol";

import { Evm } from "../../../src/index.js";

const chainId = Schema.decodeSync(SupportedEvmChainId)("eip155:1");
const account = EthereumAddress.make("0x1111111111111111111111111111111111111111");
const timeWindowId = Schema.decodeSync(PolicyId)("01900000-0000-7000-8000-000000000001");
const signaturePolicyId = Schema.decodeSync(PolicyId)("01900000-0000-7000-8000-000000000002");
const chainAllowlistPolicyId = Schema.decodeSync(PolicyId)("01900000-0000-7000-8000-000000000003");
const timeWindow = {
  id: timeWindowId,
  type: "evm.time-window",
  version: 1,
  appliesTo: "signature",
  startsAt: null,
  expiresAt: DateTime.fromEpochSeconds(10),
} satisfies EvmTimeWindowPolicy;
const signaturePolicy = {
  id: signaturePolicyId,
  type: "evm.signature",
  version: 1,
  appliesTo: "signature",
  allowedTypes: ["message"],
} satisfies EvmSignaturePolicy;
const chainAllowlistPolicy = {
  id: chainAllowlistPolicyId,
  type: "evm.chain-allowlist",
  version: 1,
  appliesTo: "signature",
  chainIds: [chainId],
} satisfies EvmChainAllowlistPolicy;
const context = {
  version: 1,
  namespace: "eip155",
  chainId,
  account,
  timestamp: DateTime.fromEpochSeconds(1),
  type: "message",
  message: "Authorize",
} satisfies EvmSignatureContext;

it.effect("requires an explicit signature policy and applies the time window", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    expect(yield* evm.policy.evaluateSignature({ policies: [timeWindow], context })).toEqual({
      allowed: false,
      code: "SIGNATURE_POLICY_REQUIRED",
    });
    expect(
      yield* evm.policy.evaluateSignature({
        policies: [timeWindow, signaturePolicy],
        context,
      }),
    ).toEqual({ allowed: true });
    expect(
      yield* evm.policy.evaluateSignature({
        policies: [timeWindow, signaturePolicy],
        context: {
          ...context,
          timestamp: DateTime.fromEpochSeconds(10),
        },
      }),
    ).toEqual({ allowed: false, policyId: timeWindowId, code: "TIME_WINDOW_EXPIRED" });
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("denies signature types not listed by the policy", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const result = yield* evm.policy.evaluateSignature({
      policies: [timeWindow, signaturePolicy],
      context: {
        ...context,
        type: "typed-data",
        typedData: {
          domain: {},
          types: { Authorization: [{ name: "action", type: "string" }] },
          primaryType: "Authorization",
          message: { action: "test" },
        },
      },
    });
    expect(result).toEqual({
      allowed: false,
      policyId: signaturePolicyId,
      code: "SIGNATURE_TYPE_NOT_ALLOWED",
    });
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("applies the chain allowlist to signatures without granting signature access", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    expect(
      yield* evm.policy.evaluateSignature({ policies: [chainAllowlistPolicy], context }),
    ).toEqual({ allowed: false, code: "SIGNATURE_POLICY_REQUIRED" });

    const denied = yield* evm.policy.evaluateSignature({
      policies: [chainAllowlistPolicy, signaturePolicy],
      context: {
        ...context,
        chainId: Schema.decodeSync(SupportedEvmChainId)("eip155:10"),
      },
    });
    expect(denied).toEqual({
      allowed: false,
      policyId: chainAllowlistPolicyId,
      code: "CHAIN_NOT_ALLOWED",
    });
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("caps signature approval at the time window and enforces its inclusive start", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const window = { ...timeWindow, startsAt: DateTime.fromEpochSeconds(1) };
    expect(
      yield* evm.policy.evaluateSignature({
        policies: [signaturePolicy, window],
        context: { ...context, timestamp: DateTime.fromEpochSeconds(0) },
      }),
    ).toEqual({ allowed: false, policyId: timeWindowId, code: "TIME_WINDOW_NOT_STARTED" });
    expect(
      yield* evm.policy.evaluateSignature({
        policies: [signaturePolicy, window],
        context,
      }),
    ).toEqual({ allowed: true });
    const latest = DateTime.fromEpochSeconds(300);
    expect(evm.policy.authorizationDeadline({ policies: [window], latest })).toEqual(
      window.expiresAt,
    );
    expect(evm.policy.authorizationDeadline({ policies: [], latest })).toEqual(latest);
  }).pipe(Effect.provide(Evm.testLayer)),
);

it("requires a non-empty unique signature chain allowlist", () => {
  expect(Schema.is(EvmChainAllowlistPolicy)({ ...chainAllowlistPolicy, chainIds: [] })).toBe(false);
  expect(
    Schema.is(EvmChainAllowlistPolicy)({ ...chainAllowlistPolicy, chainIds: [chainId, chainId] }),
  ).toBe(false);
});

it.effect("requires an explicit Arc chain grant without widening existing signature policies", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const arcPolicy = { ...chainAllowlistPolicy, chainIds: ["eip155:5042"] as const };
    for (const id of ["eip155:5042", "eip155:5042002"] as const) {
      const arcContext = { ...context, chainId: id };
      expect(
        yield* evm.policy.evaluateSignature({
          policies: [chainAllowlistPolicy, signaturePolicy],
          context: arcContext,
        }),
      ).toMatchObject({ allowed: false, code: "CHAIN_NOT_ALLOWED" });
      expect(
        yield* evm.policy.evaluateSignature({
          policies: [arcPolicy, signaturePolicy],
          context: arcContext,
        }),
      ).toMatchObject(
        id === "eip155:5042" ? { allowed: true } : { allowed: false, code: "CHAIN_NOT_ALLOWED" },
      );
      expect(
        yield* evm.policy.evaluateSignature({ policies: [arcPolicy], context: arcContext }),
      ).toMatchObject({ allowed: false, code: "SIGNATURE_POLICY_REQUIRED" });
    }
  }).pipe(Effect.provide(Evm.testLayer)),
);
