import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";

import {
  EthereumAddress,
  PolicyId,
  SupportedEvmChainId,
  type EvmSignatureContext,
  type EvmSignaturePolicy,
  type EvmTimeWindowPolicy,
} from "@namera-ai/protocol";

import { Evm } from "../src/index.js";

const chainId = Schema.decodeSync(SupportedEvmChainId)("eip155:1");
const account = EthereumAddress.make("0x1111111111111111111111111111111111111111");
const timeWindowId = Schema.decodeSync(PolicyId)("01900000-0000-7000-8000-000000000001");
const signaturePolicyId = Schema.decodeSync(PolicyId)("01900000-0000-7000-8000-000000000002");
const timeWindow = {
  id: timeWindowId,
  type: "evm.time-window",
  version: 1,
  appliesTo: "both",
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
