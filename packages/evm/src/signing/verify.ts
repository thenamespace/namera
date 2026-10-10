import { Effect } from "effect";

import { EvmSignatureError, UnsupportedChainError } from "@namera-ai/protocol";
import type { TypedDataDefinition } from "viem";

import { reconstructEvmAccount } from "../accounts/reconstruct.js";
import type { ChainData } from "../chains/data.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { ExecutionClients } from "../clients/execution.js";
import type { EvmSignatureService } from "./types.js";

export const makeVerifyEvmSignature = (
  getClients: (chain: ChainData) => Pick<ExecutionClients, "publicClient">,
): EvmSignatureService["verify"] =>
  Effect.fn("evm.signature.verify")(function* (input) {
    const chain = getChainDataByCaip2(input.chainId);
    if (chain === undefined) {
      return yield* new UnsupportedChainError({
        namespace: "eip155",
        chainId: input.chainId,
      });
    }

    const publicClient = getClients(chain).publicClient;
    const account = yield* reconstructEvmAccount(input.account, publicClient).pipe(
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
    const valid = yield* Effect.tryPromise({
      try: async () => {
        const code = await publicClient.getCode({ address: account.address });
        const factoryArgs =
          code === undefined || code === "0x" ? await account.getFactoryArgs() : undefined;
        const counterfactual =
          factoryArgs?.factory !== undefined && factoryArgs.factoryData !== undefined
            ? { factory: factoryArgs.factory, factoryData: factoryArgs.factoryData }
            : {};

        return input.type === "message"
          ? publicClient.verifyMessage({
              address: account.address,
              message: input.message,
              signature: input.signature,
              ...counterfactual,
            })
          : publicClient.verifyTypedData({
              address: account.address,
              signature: input.signature,
              ...(input.typedData as unknown as TypedDataDefinition),
              ...counterfactual,
            });
      },
      catch: (cause) => new EvmSignatureError({ code: "VERIFICATION_FAILED", cause }),
    });

    return valid;
  });
