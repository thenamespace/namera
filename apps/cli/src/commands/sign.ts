import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { SignRequest, type SignRequest as SignRequestType } from "@namera-ai/protocol/dto";

import { paramsFlag, profileFlag, resolveParams } from "#/commands/common";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";
import { CliPrompts } from "#/services/prompts";

const promptSignRequest = Effect.fn("cli.sign.promptRequest")(function* () {
  const prompts = yield* CliPrompts;
  const namespace = yield* prompts.namespace;
  const walletId = yield* prompts.walletId();
  const chainId = yield* prompts.chainId();
  const type = yield* prompts.signatureType;

  return type === "message"
    ? ({
        namespace,
        walletId,
        chainId,
        type,
        message: yield* prompts.message(),
      } satisfies SignRequestType)
    : ({
        namespace,
        walletId,
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
    yield* printValue(yield* runPromise(client.sign(request)));
  }),
).pipe(Command.withDescription("Sign an EVM message or typed-data request"));
