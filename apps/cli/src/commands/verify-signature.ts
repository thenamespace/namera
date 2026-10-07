import { Effect, Option } from "effect";
import { Command } from "effect/cli";

import { Hex } from "@namera-ai/protocol";
import { VerifySignatureRequest } from "@namera-ai/protocol/dto";

import { paramsFlag, profileFlag, resolveParams } from "#/commands/common";
import {
  inputOrPrompt,
  optionalInput,
  rejectMixedParams,
  resolveOperationScope,
  scopeFlags,
} from "#/commands/operation-input";
import { signatureFlags, signatureInput } from "#/commands/signature-input";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";
import { verificationView, type OperationContext } from "#/services/output/execution";
import { CliPrompts } from "#/services/prompts";

export const verifySignatureCommand = Command.make(
  "verify-signature",
  {
    params: paramsFlag,
    profile: profileFlag,
    namespace: scopeFlags.namespace,
    wallet: scopeFlags.wallet,
    network: scopeFlags.network,
    ...signatureFlags,
    signature: optionalInput("signature", "Hex signature to verify"),
  },
  Effect.fn(function* ({ params, profile, ...input }) {
    yield* rejectMixedParams(params, Object.values(input));
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    let context: OperationContext | undefined;
    const request = yield* resolveParams(
      params,
      VerifySignatureRequest,
      Effect.gen(function* () {
        const scope = yield* resolveOperationScope(
          client,
          { ...input, sessionKey: Option.none() },
          false,
        );
        context = scope;
        const payload = yield* signatureInput(input);
        const prompts = yield* CliPrompts;
        const signature = yield* inputOrPrompt(
          input.signature,
          "signature",
          Hex,
          prompts.hex("Signature"),
        );
        return {
          namespace: scope.namespace,
          walletId: scope.walletId,
          chainId: scope.chainId,
          ...payload,
          signature,
        };
      }),
    );
    yield* printValue(yield* runPromise(client.verifySignature(request)), (value, colors) =>
      verificationView(value, colors, context),
    );
  }),
).pipe(Command.withDescription("Check whether a wallet signature is valid"));
