import { Effect } from "effect";
import { Prompt } from "effect/unstable/cli";

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
      if (cliPolicies.length > 0) {
        const addMore = yield* Prompt.confirm({
          message: "Do you want to add another policy?",
        });
        if (!addMore) break;
      }

      const policyType = yield* policyChoicePrompt(cliPolicies);

      if (policyType === "timestamp") {
        const res = yield* getTimestampPolicyParams;
        cliPolicies.push(res);
      } else if (policyType === "call") {
        // TODO: See if we can catch duplicates in gas policy
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
