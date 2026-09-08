import { Effect } from "effect";

import { EvmExecutionError, UnsupportedChainError } from "@namera-ai/protocol";
import type { EvmSessionAuthorization, SupportedEvmChainId } from "@namera-ai/protocol/evm";
import type { AlchemyModularV2WalletData } from "@namera-ai/protocol/model";
import { createClient, custom, type Address, type Hex, type PublicClient } from "viem";

import { getWebAuthnFactoryArgs } from "../accounts/alchemy-modular-v2.js";
import { reconstructEvmAccount } from "../accounts/reconstruct.js";
import { createPublicKeyWebAuthnAccount } from "../accounts/webauthn.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import { compileEvmSession } from "./compile.js";

export type ReviewEvmSessionOperationInput = {
  readonly wallet: Extract<AlchemyModularV2WalletData, { validatorType: "webauthn_p256" }>;
  readonly ownerPublicKey: Hex;
  readonly chainId: SupportedEvmChainId;
  readonly authorization: EvmSessionAuthorization;
  readonly kind: "install" | "uninstall";
};

export type ReviewedEvmSessionOperation = {
  readonly chainId: SupportedEvmChainId;
  readonly walletAddress: Address;
  readonly ownerEntityId: number;
  readonly factory: Address;
  readonly factoryData: Hex;
  readonly callData: Hex;
};

/** Read-only reconstruction and compilation; the supplied RPC must be trusted by the caller. */
export const reviewEvmSessionOperation: (
  input: ReviewEvmSessionOperationInput,
  publicClient: PublicClient,
) => Effect.Effect<ReviewedEvmSessionOperation, EvmExecutionError | UnsupportedChainError> =
  Effect.fn("evm.sessions.reviewOperation")(function* (
    input: ReviewEvmSessionOperationInput,
    publicClient: PublicClient,
  ) {
    const chain = getChainDataByCaip2(input.chainId);
    if (chain === undefined) {
      return yield* new UnsupportedChainError({ namespace: "eip155", chainId: input.chainId });
    }
    if (publicClient.chain?.id !== chain.chain.id) {
      return yield* new EvmExecutionError({
        code: "ACCOUNT_RECONSTRUCTION_FAILED",
        cause: new Error("Review RPC client does not match the selected chain"),
      });
    }
    const account = yield* reconstructEvmAccount(
      {
        wallet: input.wallet,
        owner: {
          validatorType: "webauthn_p256",
          account: createPublicKeyWebAuthnAccount(input.ownerPublicKey),
        },
      },
      publicClient,
    );
    return yield* Effect.tryPromise({
      try: async () => {
        const compiled = await compileEvmSession(
          createClient({
            account,
            chain: chain.chain,
            transport: custom(publicClient, { retryCount: 0 }),
          }),
          input.authorization,
        );
        const { factory, factoryData } = getWebAuthnFactoryArgs(
          input.ownerPublicKey,
          input.wallet.salt,
          input.wallet.entityId,
        );
        return {
          chainId: input.chainId,
          walletAddress: account.address,
          ownerEntityId: input.wallet.entityId,
          factory,
          factoryData,
          callData:
            input.kind === "install" ? compiled.installCallData : compiled.uninstallCallData,
        };
      },
      catch: (cause) => new EvmExecutionError({ code: "PREPARATION_FAILED", cause }),
    });
  });
