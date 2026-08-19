import { Effect, Schema } from "effect";

import { Bytes32, EvmSignatureError } from "@namera-ai/protocol";
import { hashMessage, hashTypedData, type TypedDataDefinition } from "viem";

import type { DigestEvmSignature } from "./types.js";

export const digestEvmSignature: DigestEvmSignature = Effect.fn("evm.signature.digest")(
  function* (input) {
    const digest = yield* Effect.try({
      try: () =>
        input.type === "message"
          ? hashMessage(input.message)
          : hashTypedData(input.typedData as unknown as TypedDataDefinition),
      catch: (cause) => new EvmSignatureError({ code: "SIGNING_FAILED", cause }),
    });

    return yield* Schema.decodeUnknownEffect(Bytes32)(digest).pipe(
      Effect.mapError((cause) => new EvmSignatureError({ code: "SIGNING_FAILED", cause })),
    );
  },
);
