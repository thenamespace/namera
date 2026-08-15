import { Effect } from "effect";

import { EvmExecutionError } from "@namera-ai/protocol";
import type {
  ToKernelSmartAccountReturnType,
  ToSafeSmartAccountReturnType,
} from "permissionless/accounts";
import { isAddressEqual } from "viem";
import type { PublicClient } from "viem";

import { makeKernelSmartAccount } from "./kernel.js";
import { makeSafeSmartAccount } from "./safe.js";
import type { ReconstructEvmAccountInput } from "./types.js";

type EvmSmartAccount =
  | ToKernelSmartAccountReturnType<"0.7", false>
  | ToSafeSmartAccountReturnType<"0.7">;

export const reconstructEvmAccount: (
  input: ReconstructEvmAccountInput,
  publicClient: PublicClient,
) => Effect.Effect<EvmSmartAccount, EvmExecutionError> = Effect.fn("evm.accounts.reconstruct")(
  function* (input, publicClient) {
    const account = yield* Effect.tryPromise({
      try: () =>
        input.wallet.implementation === "kernel"
          ? makeKernelSmartAccount(
              {
                entryPointVersion: input.wallet.entryPointVersion,
                kernelVersion: input.wallet.kernelVersion,
                accountIndex: input.wallet.accountIndex,
                owner: input.owner,
              },
              publicClient,
            )
          : makeSafeSmartAccount(
              {
                entryPointVersion: input.wallet.entryPointVersion,
                safeVersion: input.wallet.safeVersion,
                saltNonce: input.wallet.saltNonce,
                owner: input.owner,
              },
              publicClient,
            ),
      catch: (cause) =>
        new EvmExecutionError({
          code: "ACCOUNT_RECONSTRUCTION_FAILED",
          cause,
        }),
    });

    if (!isAddressEqual(account.address, input.wallet.address)) {
      return yield* new EvmExecutionError({
        code: "ACCOUNT_ADDRESS_MISMATCH",
        cause: new Error("Reconstructed account address does not match the stored wallet address"),
      });
    }

    return account;
  },
);
