import { Effect } from "effect";

import { policyChoicePrompt } from "./base";
import { getCallPolicyParams } from "./call";
import { getGasPolicyParams } from "./gas";
import { getTimestampPolicyParams } from "./timestamp";
import type { PolicyDataType } from "./types";

export * from "./base";
export * from "./call";
export * from "./gas";
export * from "./timestamp";

export const getPoliciesFromUser = () =>
  Effect.gen(function* () {
    const cliPolicies: PolicyDataType[] = [];

    while (true) {
      // Todo: Pass prev policies to prompt, so that we can ensure that user does not add 2 timestamp policies, 2 sudo policies, etc.
      const policyType = yield* policyChoicePrompt;

      if (policyType === "timestamp") {
        const res = yield* getTimestampPolicyParams;
        cliPolicies.push(res);
      } else if (policyType === "call") {
        const res = yield* getCallPolicyParams;
        cliPolicies.push(...res);
      } else if (policyType === "sudo") {
        cliPolicies.push({ data: null, type: "sudo" });
      } else if (policyType === "gas") {
        const res = yield* getGasPolicyParams;
        cliPolicies.push(res);
      } else {
        // TODO: Add Rate Limiting Policy, Signature Policy
        break;
      }
    }

    return cliPolicies;
  });
