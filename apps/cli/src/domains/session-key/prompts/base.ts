import { Effect } from "effect";
import { Prompt } from "effect/unstable/cli";

import type { PolicyDataType } from "./types";

export const policyChoicePrompt = (prevPolicies: PolicyDataType[]) =>
  Effect.gen(function* () {
    const hasSudoPolicy = prevPolicies.some((p) => p.type === "sudo");
    const hasTimestampPolicy = prevPolicies.some((p) => p.type === "timestamp");
    const hasGasPolicy = prevPolicies.some((p) => p.type === "gas");

    const prompt = Prompt.select({
      choices: [
        {
          description: "Grant access to all operations",
          disabled: hasSudoPolicy,
          title: "Sudo Permission",
          value: "sudo",
        },
        {
          description: "Whitelist addresses, contract and functions",
          disabled: hasSudoPolicy,
          title: "Call Permission",
          value: "call",
        },
        {
          description:
            "Specify the start and end time for when the key is valid",
          disabled: hasSudoPolicy || hasTimestampPolicy,
          title: "Timestamp Permission",
          value: "timestamp",
        },
        {
          description: "Specify the allowed gas usage for the session key",
          disabled: hasSudoPolicy || hasGasPolicy,
          title: "Gas Permission",
          value: "gas",
        },
      ],
      message: "Select Permission type you want to add for this session key",
    });

    return yield* prompt;
  });
