import { Effect } from "effect";
import { Command } from "effect/cli";

import {
  PrepareSignatureRequest as SignRequest,
  type PrepareSignatureRequest as SignRequestType,
} from "@namera-ai/protocol/dto";

import { paramsFlag, profileFlag, resolveParams } from "#/commands/common";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";
import { signatureView } from "#/services/output/execution";
import { CliPrompts } from "#/services/prompts";

const promptSignRequest = Effect.fn("cli.sign.promptRequest")(function* () {
  const prompts = yield* CliPrompts;
  const namespace = yield* prompts.namespace;
  const walletId = yield* prompts.walletId();
  const sessionKeyId = yield* prompts.sessionKeyId();
  const chainId = yield* prompts.chainId();
  const type = yield* prompts.signatureType;

  return type === "message"
    ? ({
        namespace,
        walletId,
        sessionKeyId,
        chainId,
        type,
        message: yield* prompts.message(),
      } satisfies SignRequestType)
    : ({
        namespace,
        walletId,
        sessionKeyId,
        chainId,
        type,
        typedData: yield* prompts.typedData,
      } satisfies SignRequestType);
});

export const signCommand = Command.make(
  "sign",
  { params: paramsFlag, profile: profileFlag },
  Effect.fn(function* ({ params, profile }) {
    const request = yield* resolveParams(params, SignRequest, promptSignRequest());
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.sign(request)), signatureView);
  }),
).pipe(Command.withDescription("Sign an EVM message or typed-data request"));
