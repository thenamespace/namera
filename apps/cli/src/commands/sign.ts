import { Effect } from "effect";
import { Command } from "effect/cli";

import { SessionKeyId } from "@namera-ai/protocol";
import { PrepareSignatureRequest } from "@namera-ai/protocol/dto";

import { paramsFlag, profileFlag, resolveParams } from "#/commands/common";
import {
  parseInput,
  rejectMixedParams,
  resolveOperationScope,
  scopeFlags,
} from "#/commands/operation-input";
import { signatureFlags, signatureInput } from "#/commands/signature-input";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";
import { signatureView, type OperationContext } from "#/services/output/execution";

export const signCommand = Command.make(
  "sign",
  {
    params: paramsFlag,
    profile: profileFlag,
    ...scopeFlags,
    ...signatureFlags,
  },
  Effect.fn(function* ({ params, profile, ...input }) {
    yield* rejectMixedParams(params, Object.values(input));
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    let context: OperationContext | undefined;
    const request = yield* resolveParams(
      params,
      PrepareSignatureRequest,
      Effect.gen(function* () {
        const scope = yield* resolveOperationScope(client, input);
        context = scope;
        const sessionKeyId = yield* parseInput(SessionKeyId, scope.sessionKeyId, "session-key");
        return {
          namespace: scope.namespace,
          walletId: scope.walletId,
          sessionKeyId,
          chainId: scope.chainId,
          ...(yield* signatureInput(input)),
        };
      }),
    );
    yield* printValue(yield* runPromise(client.sign(request)), (value, colors) =>
      signatureView(value, colors, context),
    );
  }),
).pipe(Command.withDescription("Sign a message or typed data with your wallet"));
