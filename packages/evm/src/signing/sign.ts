import { Effect, Schema } from "effect";

import { EvmSignatureError, Hex, UnsupportedChainError } from "@namera-ai/protocol";
import type { TypedDataDefinition } from "viem";

import { reconstructEvmAccount } from "../accounts/reconstruct.js";
import type { ChainData } from "../chains/data.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { ExecutionClients } from "../clients/execution.js";
import { digestEvmSignature } from "./digest.js";
import type { EvmSignatureService } from "./types.js";
import { makeVerifyEvmSignature } from "./verify.js";

export const makeEvmSignatureService = (
  getClients: (chain: ChainData) => ExecutionClients,
): EvmSignatureService => ({
  digest: digestEvmSignature,
  sign: Effect.fn("evm.signature.sign")(function* (input) {
    const chain = getChainDataByCaip2(input.chainId);
    if (chain === undefined || !chain.operationsEnabled) {
      return yield* new UnsupportedChainError({
        namespace: "eip155",
        chainId: input.chainId,
      });
    }

    const account = yield* reconstructEvmAccount(
      input.account,
      getClients(chain).publicClient,
    ).pipe(
      Effect.mapError(
        (error) =>
          new EvmSignatureError({
            code:
              error.code === "ACCOUNT_ADDRESS_MISMATCH"
                ? "ACCOUNT_ADDRESS_MISMATCH"
                : "ACCOUNT_RECONSTRUCTION_FAILED",
            cause: error,
          }),
      ),
    );
    const signature = yield* Effect.tryPromise({
      try: () =>
        input.type === "message"
          ? account.signMessage({ message: input.message })
          : account.signTypedData(input.typedData as unknown as TypedDataDefinition),
      catch: (cause) => new EvmSignatureError({ code: "SIGNING_FAILED", cause }),
    });

    return yield* Schema.decodeUnknownEffect(Hex)(signature).pipe(
      Effect.mapError((cause) => new EvmSignatureError({ code: "SIGNING_FAILED", cause })),
    );
  }),
  verify: makeVerifyEvmSignature(getClients),
});
