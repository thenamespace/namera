import {
  type Policy,
  toCallPolicy,
  toGasPolicy,
  toRateLimitPolicy,
  toSignatureCallerPolicy,
  toSudoPolicy,
  toTimestampPolicy,
} from "@namera-ai/core/policy";

type PolicyParams = Policy["policyParams"][];

export const policyParamsToPolicies = (
  policyParams: PolicyParams,
): Policy[] => {
  const policies: Policy[] = [];

  for (const params of policyParams) {
    if (params.type === "sudo") {
      policies.push(toSudoPolicy(params));
    } else if (params.type === "call") {
      policies.push(toCallPolicy(params));
    } else if (params.type === "gas") {
      policies.push(toGasPolicy(params));
    } else if (params.type === "timestamp") {
      policies.push(toTimestampPolicy(params));
    } else if (params.type === "rate-limit") {
      policies.push(toRateLimitPolicy(params));
    } else {
      policies.push(toSignatureCallerPolicy(params));
    }
  }

  return policies;
};
