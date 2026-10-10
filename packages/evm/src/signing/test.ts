import { type Duration, Effect, Schema } from "effect";

import { EvmSignatureError, EvmTypedData, Hex } from "@namera-ai/protocol";
import { verifyTypedData, type TypedDataDefinition } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { digestEvmSignature } from "./digest.js";
import type { EvmSessionSignatureService } from "./types.js";

export const createTestEvmSessionSigner = () => {
  const key = privateKeyToAccount(generatePrivateKey());
  return {
    publicKey: Hex.make(key.publicKey),
    sign: async (typedData: EvmTypedData) =>
      Hex.make(await key.signTypedData(typedData as unknown as TypedDataDefinition)),
  };
};

/** HTTP/persistence fixture: real ECDSA, substituted chain/validation envelope. */
export const makeTestEvmSessionSignatureService = (
  options: {
    readonly verificationDelay?: Duration.Input;
    readonly onVerification?: Effect.Effect<void>;
  } = {},
): EvmSessionSignatureService => {
  const prepare: EvmSessionSignatureService["prepare"] = Effect.fnUntraced(function* (input) {
    const hash = yield* digestEvmSignature(input);
    return Schema.decodeUnknownSync(EvmTypedData)({
      domain: {
        name: "Namera test session signer",
        verifyingContract: input.account.wallet.address,
      },
      types: { TestPayload: [{ name: "hash", type: "bytes32" }] },
      primaryType: "TestPayload",
      message: { hash },
    });
  });
  return {
    prepare,
    complete: Effect.fnUntraced(function* (input) {
      if (options.onVerification !== undefined) yield* options.onVerification;
      if (options.verificationDelay !== undefined) yield* Effect.sleep(options.verificationDelay);
      const typedData = yield* prepare(input);
      const valid = yield* Effect.tryPromise({
        try: () =>
          verifyTypedData({
            ...(typedData as unknown as TypedDataDefinition),
            address: input.session.authorization.signerAddress,
            signature: input.signature,
          }),
        catch: (cause) => new EvmSignatureError({ code: "SIGNING_FAILED", cause }),
      });
      if (!valid)
        return yield* new EvmSignatureError({
          code: "SIGNING_FAILED",
          cause: new Error("Test signature mismatch"),
        });
      return Hex.make("0x1234");
    }),
  };
};
