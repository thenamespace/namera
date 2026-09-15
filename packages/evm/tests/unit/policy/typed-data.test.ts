import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";

import { EvmSignaturePolicy, EvmSignatureContext, SupportedEvmChainId } from "@namera-ai/protocol";

import { Evm } from "../../../src/index.js";

const policy = Schema.decodeUnknownSync(EvmSignaturePolicy)({
  id: "01900000-0000-7000-8000-000000000001",
  type: "evm.signature",
  version: 1,
  appliesTo: "signature",
  allowedTypes: ["message", "typed-data"],
  typedDataRules: [
    {
      chainId: "eip155:1",
      verifyingContract: "0x1111111111111111111111111111111111111111",
      name: "Example",
      version: "1",
      primaryTypes: ["Permit"],
    },
    {
      chainId: "eip155:1",
      verifyingContract: "0x3333333333333333333333333333333333333333",
      name: "Other",
      primaryTypes: ["Transfer"],
    },
  ],
});
const context = Schema.decodeUnknownSync(EvmSignatureContext)({
  version: 1,
  namespace: "eip155",
  chainId: "eip155:1",
  account: "0x2222222222222222222222222222222222222222",
  timestamp: DateTime.toDateUtc(DateTime.fromEpochSeconds(1)),
  type: "typed-data",
  typedData: {
    domain: {
      chainId: 1,
      verifyingContract: "0x1111111111111111111111111111111111111111",
      name: "Example",
      version: "1",
    },
    types: { Permit: [{ name: "action", type: "string" }] },
    primaryType: "Permit",
    message: { action: "test" },
  },
});

it.effect("allows typed data without rules but still requires the signature type", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const { typedDataRules: _rules, ...unrestricted } = policy;
    expect(yield* evm.policy.evaluateSignature({ policies: [unrestricted], context })).toEqual({
      allowed: true,
    });
    expect(
      yield* evm.policy.evaluateSignature({
        policies: [{ ...unrestricted, allowedTypes: ["message"] }],
        context,
      }),
    ).toEqual({
      allowed: false,
      policyId: policy.id,
      code: "SIGNATURE_TYPE_NOT_ALLOWED",
    });
    expect(yield* evm.policy.evaluateSignature({ policies: [], context })).toMatchObject({
      allowed: false,
    });
  }).pipe(Effect.provide(Evm.testLayer)),
);

it.effect("matches one complete typed-data rule and rejects missing or substituted fields", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    if (context.type !== "typed-data") return yield* Effect.die("Expected typed data fixture");
    expect(yield* evm.policy.evaluateSignature({ policies: [policy], context })).toEqual({
      allowed: true,
    });
    const { typedData } = context;
    const variants = [
      { ...typedData, primaryType: "Transfer" },
      ...[
        {},
        { ...typedData.domain, chainId: 8453 },
        { ...typedData.domain, name: "example" },
        { ...typedData.domain, name: "Other" },
        { ...typedData.domain, version: "2" },
        { ...typedData.domain, verifyingContract: context.account },
      ].map((domain) => ({
        domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      })),
    ];
    for (const value of variants)
      expect(
        yield* evm.policy.evaluateSignature({
          policies: [policy],
          context: { ...context, typedData: value },
        }),
      ).toEqual({ allowed: false, policyId: policy.id, code: "TYPED_DATA_NOT_ALLOWED" });
    expect(
      yield* evm.policy.evaluateSignature({
        policies: [policy],
        context: { ...context, type: "message", message: "hello" },
      }),
    ).toEqual({ allowed: true });
    expect(
      yield* evm.policy.evaluateSignature({
        policies: [policy],
        context: { ...context, chainId: Schema.decodeSync(SupportedEvmChainId)("eip155:8453") },
      }),
    ).toEqual({ allowed: false, policyId: policy.id, code: "TYPED_DATA_NOT_ALLOWED" });
  }).pipe(Effect.provide(Evm.testLayer)),
);
