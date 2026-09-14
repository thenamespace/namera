import { Effect } from "effect";

import type { EvmCallAccessPolicy, EvmIntentContext, EvmPolicyDecision } from "@namera-ai/protocol";

import { assertSafeSessionPermissions } from "../../sessions/permission-safety.js";

function asPermission(policy: EvmCallAccessPolicy) {
  switch (policy.type) {
    case "evm.contract-access":
      return { type: "contract-access", address: policy.address } as const;
    case "evm.functions-on-contract":
      return {
        type: "functions-on-contract",
        address: policy.address,
        functions: policy.functions,
      } as const;
    case "evm.functions-on-all-contracts":
      return { type: "functions-on-all-contracts", functions: policy.functions } as const;
    case "evm.account-functions":
      return { type: "account-functions", functions: policy.functions } as const;
  }
}

export const callAccessHandler = <Type extends EvmCallAccessPolicy["type"]>(type: Type) => ({
  type,
  evaluate: Effect.fn("evm.policy.call-access.evaluate")(
    (
      policy: Extract<EvmCallAccessPolicy, { type: Type }>,
      context: EvmIntentContext,
    ): Effect.Effect<EvmPolicyDecision> => {
      try {
        assertSafeSessionPermissions(context.account, [asPermission(policy)]);
      } catch {
        return Effect.succeed({ allowed: false, policyId: policy.id, code: "CALL_NOT_ALLOWED" });
      }
      const allowed = context.calls.every((call) => {
        const target = call.to.toLowerCase();
        if (policy.type === "evm.account-functions") {
          if (target !== context.account.toLowerCase()) return false;
        } else {
          // Wildcards must not expose account self-dispatch or permission management.
          try {
            assertSafeSessionPermissions(context.account, [
              { type: "contract-access", address: call.to },
            ]);
          } catch {
            return false;
          }
        }
        if ("address" in policy && target !== policy.address.toLowerCase()) return false;
        return (
          !("functions" in policy) ||
          (call.data.length >= 10 &&
            policy.functions.some(
              (selector) => selector.toLowerCase() === call.data.slice(0, 10).toLowerCase(),
            ))
        );
      });
      return Effect.succeed(
        allowed
          ? { allowed: true }
          : { allowed: false, policyId: policy.id, code: "CALL_NOT_ALLOWED" },
      );
    },
  ),
});
