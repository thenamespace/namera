import type { Policy } from "@namera-ai/core/policy";
import { Effect } from "effect";
import { Prompt } from "effect/unstable/cli";

import { policyChoicePrompt } from "./base";
import { getCallPolicyParams } from "./call";
import { getGasPolicyParams } from "./gas";
import { getTimestampPolicyParams } from "./timestamp";

export * from "./base";
export * from "./call";
export * from "./gas";
export * from "./timestamp";

type PolicyParams = Policy["policyParams"][];

export const getPoliciesFromUser = () =>
  Effect.gen(function* () {
    const policyParams: PolicyParams = [];

    while (true) {
      if (policyParams.length > 0) {
        const addMore = yield* Prompt.confirm({
          message: "Do you want to add another policy?",
        });
        if (!addMore) break;
      }

      const policyType = yield* policyChoicePrompt(policyParams);

      if (policyType === "timestamp") {
        const res = yield* getTimestampPolicyParams;
        policyParams.push(res);
      } else if (policyType === "call") {
        // TODO: See if we can catch duplicates in gas policy
        const res = yield* getCallPolicyParams;
        policyParams.push(res);
      } else if (policyType === "sudo") {
        policyParams.push({ type: "sudo" });
      } else if (policyType === "gas") {
        const res = yield* getGasPolicyParams;
        policyParams.push(res);
      } else {
        // TODO: Add Rate Limiting Policy, Signature Policy
        break;
      }
    }

    return policyParams;
  });
