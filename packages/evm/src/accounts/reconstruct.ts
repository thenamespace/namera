import { Effect } from "effect";

import { EvmExecutionError } from "@namera-ai/protocol";
import type { KernelWalletData, SafeWalletData } from "@namera-ai/protocol/model";
import { isAddressEqual } from "viem";
import type { LocalAccount, PublicClient } from "viem";
import type { SmartAccount, WebAuthnAccount } from "viem/account-abstraction";

import { makeKernelSmartAccount } from "./kernel.js";
import { makeSafeSmartAccount } from "./safe.js";

export type ReconstructEvmAccountInput = {
  readonly wallet: KernelWalletData | SafeWalletData;
  readonly owner: WebAuthnAccount | LocalAccount;
};

export const reconstructEvmAccount: (
  input: ReconstructEvmAccountInput,
  publicClient: PublicClient,
) => Effect.Effect<SmartAccount, EvmExecutionError> = Effect.fn("evm.accounts.reconstruct")(
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
