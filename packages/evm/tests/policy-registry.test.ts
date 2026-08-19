import { expect, it } from "@effect/vitest";

import { evmPolicyRegistry } from "../src/policy/registry.js";

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
