import { Effect } from "effect";

import { EvmExecutionError } from "@namera-ai/protocol";
import { isAddressEqual } from "viem";
import type { PublicClient } from "viem";
import type { SmartAccount } from "viem/account-abstraction";

import { makeAlchemyModularV2Account } from "./alchemy-modular-v2.js";
import type { ReconstructEvmAccountInput } from "./types.js";

export const reconstructEvmAccount: (
  input: ReconstructEvmAccountInput,
  publicClient: PublicClient,
) => Effect.Effect<SmartAccount, EvmExecutionError> = Effect.fn("evm.accounts.reconstruct")(
  function* (input, publicClient) {
    if (input.wallet.validatorType !== input.owner.validatorType) {
      return yield* new EvmExecutionError({
        code: "ACCOUNT_RECONSTRUCTION_FAILED",
        cause: new Error("Stored validator type does not match the supplied account owner"),
      });
    }

    const account = yield* Effect.tryPromise({
      try: () => {
        if (
          input.wallet.validatorType === "webauthn_p256" &&
          input.owner.validatorType === "webauthn_p256"
        ) {
          return makeAlchemyModularV2Account(
            {
              entryPointVersion: input.wallet.entryPointVersion,
              salt: input.wallet.salt,
              entityId: input.wallet.entityId,
              owner: input.owner,
            },
            publicClient,
          );
        }

        if (
          input.wallet.validatorType === "ecdsa_secp256k1" &&
          input.owner.validatorType === "ecdsa_secp256k1"
        ) {
          return makeAlchemyModularV2Account(
            {
              entryPointVersion: input.wallet.entryPointVersion,
              delegationVersion: input.wallet.delegationVersion,
              owner: input.owner,
            },
            publicClient,
          );
        }

        throw new Error("Stored validator type does not match the supplied account owner");
      },
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
