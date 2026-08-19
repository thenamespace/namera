import { expect, it } from "@effect/vitest";
import { DateTime } from "effect";

import { PolicyId, type EvmTimeWindowPolicy } from "@namera-ai/protocol";

import { evmPolicyRegistry, orderEvmPolicies } from "../src/policy/registry.js";

it("declares operation applicability for every current EVM policy", () => {
  expect(evmPolicyRegistry["evm.native-spend-limit"].applicability).toBe("execution");
  expect(evmPolicyRegistry["evm.native-spend-limit"].execution.kind).toBe("stateful");
  expect(evmPolicyRegistry["evm.native-spend-limit"].signature.kind).toBe("not-applicable");

  expect(evmPolicyRegistry["evm.time-window"].applicability).toBe("both");
  expect(evmPolicyRegistry["evm.time-window"].execution.kind).toBe("stateless");
  expect(evmPolicyRegistry["evm.time-window"].signature).toMatchObject({
    kind: "stateless",
    grantsAccess: false,
  });

  expect(evmPolicyRegistry["evm.signature"].applicability).toBe("signature");
  expect(evmPolicyRegistry["evm.signature"].execution.kind).toBe("not-applicable");
  expect(evmPolicyRegistry["evm.signature"].signature).toMatchObject({
    kind: "stateless",
    grantsAccess: true,
  });
});

it("uses policy id as a stable tie-breaker within a priority", () => {
  const earlier = {
    id: PolicyId.make("01900000-0000-7000-8000-000000000001"),
    type: "evm.time-window",
    version: 1,
    appliesTo: "both",
    startsAt: DateTime.fromEpochSeconds(0),
    expiresAt: DateTime.fromEpochSeconds(1),
  } satisfies EvmTimeWindowPolicy;
  const later = {
    ...earlier,
    id: PolicyId.make("01900000-0000-7000-8000-000000000002"),
  } satisfies EvmTimeWindowPolicy;

  expect(orderEvmPolicies([later, earlier])).toEqual([earlier, later]);
});
