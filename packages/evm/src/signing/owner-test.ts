import { Effect } from "effect";

import { Bytes32, EvmSignatureError, Hex } from "@namera-ai/protocol";
import { hashTypedData } from "viem";

import { replaySafeTypedData } from "../accounts/alchemy-modular-v2.js";
import { encodeVerifiedOwnerAssertion } from "../accounts/passkey-signature.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import { digestEvmSignature } from "./digest.js";
import type { EvmOwnerSignatureService } from "./owner.js";

/** Real payload hashes/owner callbacks; substitutes account reconstruction and chain wrapping. */
export const makeTestEvmOwnerSignatureService = (
  options: { readonly onComplete?: Effect.Effect<void> } = {},
): EvmOwnerSignatureService => {
  const prepare: EvmOwnerSignatureService["prepare"] = Effect.fnUntraced(function* (input) {
    const digest = yield* digestEvmSignature(input);
    const chain = getChainDataByCaip2(input.chainId);
    if (!chain || !chain.operationsEnabled)
      return yield* new EvmSignatureError({
        code: "NETWORK_PAUSED",
        cause: new Error("Test network paused"),
      });
    return input.account.owner.validatorType === "webauthn_p256"
      ? Bytes32.make(
          hashTypedData(
            replaySafeTypedData({
              accountAddress: input.account.wallet.address,
              chainId: chain.chain.id,
              hash: digest,
            }),
          ),
        )
      : null;
  });
  return {
    prepare,
    complete: Effect.fnUntraced(function* (input) {
      if (options.onComplete) yield* options.onComplete;
      yield* prepare(input);
      if (input.account.owner.validatorType === "webauthn_p256") {
        if (!input.assertion)
          return yield* new EvmSignatureError({
            code: "SIGNING_FAILED",
            cause: new Error("Missing assertion"),
          });
        return Hex.make(encodeVerifiedOwnerAssertion(input.assertion));
      }
      const digest = yield* digestEvmSignature(input);
      const account = input.account.owner.account;
      return yield* Effect.tryPromise({
        try: async () => Hex.make(await account.signMessage({ message: { raw: digest } })),
        catch: (cause) => new EvmSignatureError({ code: "SIGNING_FAILED", cause }),
      });
    }),
  };
};
