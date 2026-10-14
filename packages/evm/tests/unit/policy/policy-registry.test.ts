import { expect, it } from "@effect/vitest";
import { DateTime } from "effect";

import {
  PolicyId,
  type CreateEvmTimeWindowPolicy,
  type EvmTimeWindowPolicy,
} from "@namera-ai/protocol";

import {
  evmPolicyRegistry,
  findEvmPolicyCardinalityViolation,
  materializeEvmPolicy,
  orderEvmPolicies,
} from "../../../src/policy/registry.js";

it("exposes only signature policies", () => {
  expect(Object.keys(evmPolicyRegistry).toSorted()).toEqual([
    "evm.chain-allowlist",
    "evm.signature",
    "evm.time-window",
  ]);
  for (const definition of Object.values(evmPolicyRegistry)) {
    expect(definition.applicability).toBe("signature");
    expect(definition.cardinality).toBe("singleton");
    expect(definition.signature.grantsAccess).toBe(definition.type === "evm.signature");
  }
});

it("materializes code-owned policy metadata without a policy switch", () => {
  const id = PolicyId.make("01900000-0000-7000-8000-000000000001");
  const input = {
    type: "evm.time-window",
    version: 1,
    startsAt: null,
    expiresAt: DateTime.fromEpochSeconds(1),
  } satisfies CreateEvmTimeWindowPolicy;

  expect(materializeEvmPolicy(input, id)).toEqual({ ...input, id, appliesTo: "signature" });
});

it("reports only repeated singleton policies", () => {
  const timeWindow = {
    type: "evm.time-window",
    version: 1,
    startsAt: null,
    expiresAt: DateTime.fromEpochSeconds(1),
  } satisfies CreateEvmTimeWindowPolicy;

  expect(findEvmPolicyCardinalityViolation([timeWindow])).toBeUndefined();
  expect(findEvmPolicyCardinalityViolation([timeWindow, timeWindow])).toBe("evm.time-window");
});

it("uses policy id as a stable tie-breaker within a priority", () => {
  const earlier = {
    id: PolicyId.make("01900000-0000-7000-8000-000000000001"),
    type: "evm.time-window",
    version: 1,
    appliesTo: "signature",
    startsAt: DateTime.fromEpochSeconds(0),
    expiresAt: DateTime.fromEpochSeconds(1),
  } satisfies EvmTimeWindowPolicy;
  const later = {
    ...earlier,
    id: PolicyId.make("01900000-0000-7000-8000-000000000002"),
  } satisfies EvmTimeWindowPolicy;

  expect(orderEvmPolicies([later, earlier])).toEqual([earlier, later]);
});
