import {
  CallPolicyVersion,
  toCallPolicy,
  toGasPolicy,
  toSudoPolicy,
  toTimestampPolicy,
} from "@namera-ai/core";

import type { PolicyDataType } from "../prompts/types";

export type Policy = ReturnType<typeof toSudoPolicy>;
export const cliPoliciesToPolicies = (
  cliPolicies: PolicyDataType[],
): Policy[] => {
  const policies: Policy[] = [];

  const cliCallPolicies = cliPolicies.filter((p) => p.type === "call");
  const otherPolicies = cliPolicies.filter((p) => p.type !== "call");

  const callPolicy = toCallPolicy({
    permissions: cliCallPolicies.map((p) => {
      const { target, valueLimit } = p.data;

      if ("abi" in p.data) {
        return {
          abi: p.data.abi,
          functionName: p.data.functionName,
          selector: p.data.selector,
          target,
          valueLimit: BigInt(valueLimit),
        };
      }
      return {
        target,
        valueLimit: BigInt(valueLimit),
      };
    }),
    policyVersion: CallPolicyVersion.V0_0_4,
  });

  if (cliCallPolicies.length > 0) {
    policies.push(callPolicy);
  }

  for (const policy of otherPolicies) {
    if (policy.type === "sudo") {
      policies.push(toSudoPolicy({}));
    } else if (policy.type === "timestamp") {
      const { validAfter, validUntil } = policy.data;
      policies.push(
        toTimestampPolicy({
          validAfter: validAfter.getTime(),
          validUntil: validUntil.getTime(),
        }),
      );
    } else if (policy.type === "gas") {
      const { allowed } = policy.data;
      policies.push(toGasPolicy({ allowed: BigInt(allowed) }));
    }
  }

  return policies;
};
