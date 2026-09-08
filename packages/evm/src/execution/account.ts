import { Effect } from "effect";

import { DefaultModuleAddress, toModularAccountV2Base } from "@alchemy/smart-accounts";
import { EvmExecutionError } from "@namera-ai/protocol";
import { createClient, custom, isAddressEqual, type PublicClient } from "viem";
import type { SmartAccount } from "viem/account-abstraction";
import { toAccount } from "viem/accounts";

import { reconstructEvmAccount } from "../accounts/reconstruct.js";
import type { ChainData } from "../chains/data.js";
import type { PrepareEvmExecutionInput } from "./types.js";

const localSigningUnavailable = async (): Promise<never> => {
  throw new Error("Local session signing must be completed outside the server");
};

/** Reconstruct the wallet identity first, then select its installed session validator. */
export const reconstructExecutionAccount: (
  input: Pick<PrepareEvmExecutionInput, "account" | "session">,
  chain: ChainData,
  publicClient: PublicClient,
) => Effect.Effect<SmartAccount, EvmExecutionError> = Effect.fn("evm.execution.reconstructAccount")(
  function* (
    input: Pick<PrepareEvmExecutionInput, "account" | "session">,
    chain: ChainData,
    publicClient: PublicClient,
  ): Effect.fn.Return<SmartAccount, EvmExecutionError> {
    const root = yield* reconstructEvmAccount(input.account, publicClient);
    if (input.session === undefined) return root;
    const session = input.session;
    if (
      !isAddressEqual(session.moduleAddress, DefaultModuleAddress.SINGLE_SIGNER_VALIDATION) ||
      session.authorization.entityId === 0 ||
      (input.account.wallet.validatorType === "webauthn_p256" &&
        session.authorization.entityId === input.account.wallet.entityId)
    ) {
      return yield* new EvmExecutionError({
        code: "ACCOUNT_RECONSTRUCTION_FAILED",
        cause: new Error("Session validator must be a dedicated single-signer entity"),
      });
    }

    return yield* Effect.tryPromise({
      try: async () => {
        const code = await publicClient.getCode({ address: root.address });
        if (code === undefined || code === "0x")
          throw new Error("Session execution requires an installed account");
        return toModularAccountV2Base({
          client: createClient({ chain: chain.chain, transport: custom(publicClient) }),
          accountAddress: root.address,
          owner: toAccount({
            address: session.authorization.signerAddress,
            signMessage: localSigningUnavailable,
            signTypedData: localSigningUnavailable,
            signTransaction: localSigningUnavailable,
          }),
          signerEntity: {
            entityId: session.authorization.entityId,
            isGlobalValidation: session.isGlobal,
          },
          getFactoryArgs: async () => ({}),
        });
      },
      catch: (cause) => new EvmExecutionError({ code: "ACCOUNT_RECONSTRUCTION_FAILED", cause }),
    });
  },
);
