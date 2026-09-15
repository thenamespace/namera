import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import {
  VerifySignatureRequest,
  type VerifySignatureRequest as VerifySignatureRequestType,
} from "@namera-ai/protocol/dto";

import { paramsFlag, profileFlag, resolveParams } from "#/commands/common";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";
import { verificationView } from "#/services/output/execution";
import { CliPrompts } from "#/services/prompts";

const promptVerifySignatureRequest = Effect.fn("cli.verifySignature.promptRequest")(function* () {
  const prompts = yield* CliPrompts;
  const namespace = yield* prompts.namespace;
  const walletId = yield* prompts.walletId();
  const chainId = yield* prompts.chainId();
  const type = yield* prompts.signatureType;
  const signature = yield* prompts.hex("Signature");

  return type === "message"
    ? ({
        namespace,
        walletId,
        chainId,
        type,
        signature,
        message: yield* prompts.message(),
      } satisfies VerifySignatureRequestType)
    : ({
        namespace,
        walletId,
        chainId,
        type,
        signature,
        typedData: yield* prompts.typedData,
      } satisfies VerifySignatureRequestType);
});

export const verifySignatureCommand = Command.make(
  "verify-signature",
  { params: paramsFlag, profile: profileFlag },
  Effect.fn(function* ({ params, profile }) {
    const request = yield* resolveParams(
      params,
      VerifySignatureRequest,
      promptVerifySignatureRequest(),
    );
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.verifySignature(request)), verificationView);
  }),
).pipe(Command.withDescription("Verify an EVM smart-account signature"));
