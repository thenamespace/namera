import { Prompt } from "effect/unstable/cli";

export const policyChoicePrompt = Prompt.select({
  choices: [
    {
      description: "Grant access to all operations",
      title: "Sudo Permission",
      value: "sudo",
    },
    {
      description: "Whitelist addresses, contract and functions",
      title: "Call Permission",
      value: "call",
    },
    {
      description: "Specify the start and end time for when the key is valid",
      title: "Timestamp Permission",
      value: "timestamp",
    },
    {
      description: "Specify the allowed gas usage for the session key",
      title: "Gas Permission",
      value: "gas",
    },
    {
      description: "Stop adding permissions",
      title: "Done",
      value: "done",
    },
  ],
  message: "Select Permission type you want to add for this session key",
});
