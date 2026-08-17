import { Effect } from "effect";
import { Tool } from "effect/unstable/ai";

import { Application } from "@namera-ai/application";
import { SignRequest, SignResponse } from "@namera-ai/protocol/dto";

import { registerMcpTool, signingHints } from "./register.js";

const Sign = Tool.make("sign", {
  description:
    "Sign an EVM message or EIP-712 typed data through one delegated session key with an explicit signature policy.",
  parameters: SignRequest,
  success: SignResponse,
});

export const SignatureTools = Effect.gen(function* () {
  const app = yield* Application;

  yield* registerMcpTool({
    tool: Sign,
    requiredScope: "mcp:execute",
    hints: signingHints,
    errorMessage: "The payload could not be signed.",
    handle: (request, principal) => app.signature.sign({ actor: principal, request }),
  });
});
