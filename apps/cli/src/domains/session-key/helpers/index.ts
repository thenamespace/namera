import {
  type Policy,
  toCallPolicy,
  toGasPolicy,
  toRateLimitPolicy,
  toSignatureCallerPolicy,
  toSudoPolicy,
  toTimestampPolicy,
} from "@namera-ai/core/policy";
import { formatEther } from "viem";

import type { LocalSessionKeyData } from "@/layers";

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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ignore complexity
export const formatSessionKeyData = (data: LocalSessionKeyData) => {
  let out = "\nPolicies:\n\n";
  let policyCount = 1;

  const policyParams = (
    data.data.accountParams.permissionParams.policies ?? []
  ).map((p) => p.policyParams);

  for (const params of policyParams) {
    if (params.type === "sudo") {
      out += `${policyCount}. Sudo Policy\n`;
    } else if (params.type === "timestamp") {
      out += `${policyCount}. Timestamp Policy\n`;
      const validFrom = params.validAfter
        ? new Date(params.validAfter).toLocaleDateString()
        : null;
      const validUntil = params.validUntil
        ? new Date(params.validUntil).toLocaleDateString()
        : null;
      out += `\tValid From: ${validFrom}\n`;
      out += `\tValid Until: ${validUntil}\n`;
    } else if (params.type === "gas") {
      out += `${policyCount}. Gas Policy\n`;
      const allowed = formatEther(params.allowed ?? 0n);
      out += `\tGas Limit: ${allowed} ETH\n`;
    } else if (params.type === "signature-caller") {
      out += `${policyCount}. Signature Caller Policy\n`;
      const allowedCallers = params.allowedCallers ?? [];
      out += `\tAllowed Callers: ${allowedCallers.join(", ")}\n`;
    } else if (params.type === "rate-limit") {
      out += `${policyCount}. Rate Limit Policy\n`;
      const count = params.count;
      const per = params.interval;
      out += `\tCount: ${count}\n`;
      out += `\tInterval: ${per} seconds\n`;
    } else if (params.type === "call") {
      out += `${policyCount}. Call Policy\n`;
      out += "Permissions:\n";
      for (const permission of params.permissions ?? []) {
        const target = permission.target;
        const limit = formatEther(permission.valueLimit ?? 0n);

        out += `    Target Address: ${target}\n`;
        out += `    Value Limit: ${limit} ETH\n`;

        if ("abi" in permission) {
          const fn = permission.functionName;
          out += ` Function Name: ${fn}\n`;
        }
      }
    }

    policyCount++;
  }

  return out;
};
