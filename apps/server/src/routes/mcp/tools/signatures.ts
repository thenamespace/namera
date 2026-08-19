import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";

import { Application } from "@namera-ai/application";
import {
  McpSignRequest,
  McpToolError,
  McpVerifySignatureRequest,
  SignResponse,
  VerifySignatureResponse,
} from "@namera-ai/protocol/dto";

import { registerMcpTool, signingHints, verificationHints } from "./register.js";

const Sign = Tool.make("sign", {
  description:
    "Sign an exact UTF-8 message or EIP-712 typed-data object with a delegated Namera wallet. Use walletId from list_wallets, never a wallet address or session-key ID. Namera automatically selects an eligible session key and enforces its signature policy. Signing does not submit a transaction.",
  parameters: McpSignRequest,
  success: Schema.Struct({
    signature: Schema.optionalKey(SignResponse),
    error: Schema.optionalKey(McpToolError),
  }),
});

const VerifySignature = Tool.make("verify_signature", {
  description:
    "Verify a smart-account signature against the exact original message or EIP-712 typed data. Use walletId from list_wallets and provide the original payload without modification. This supports deployed ERC-1271 accounts and counterfactual ERC-6492 signatures. A valid false result is a normal verification result and does not mean the tool failed.",
  parameters: McpVerifySignatureRequest,
  success: Schema.Struct({
    verification: Schema.optionalKey(VerifySignatureResponse),
    error: Schema.optionalKey(McpToolError),
  }),
});

export const SignatureTools = Effect.gen(function* () {
  const app = yield* Application;

  yield* registerMcpTool({
    tool: Sign,
    title: "Sign payload",
    requiredScope: "mcp:execute",
    hints: signingHints,
    handle: ({ request }, principal) =>
      app.signature
        .sign({ actor: principal, idempotencyKey: crypto.randomUUID(), request })
        .pipe(Effect.map((signature) => ({ signature }))),
  });

  yield* registerMcpTool({
    tool: VerifySignature,
    title: "Verify signature",
    requiredScope: "mcp:read",
    hints: verificationHints,
    handle: ({ request }, principal) =>
      app.signature
        .verify({ actor: principal, request })
        .pipe(Effect.map((verification) => ({ verification }))),
  });
});
