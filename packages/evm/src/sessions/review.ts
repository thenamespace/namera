import { Effect, Schema } from "effect";

import { toModularAccountV2 } from "@alchemy/smart-accounts";
import { EvmExecutionError, UnsupportedChainError } from "@namera-ai/protocol";
import type { EvmSessionAuthorization, SupportedEvmChainId } from "@namera-ai/protocol/evm";
import type { AlchemyModularV2WalletData } from "@namera-ai/protocol/model";
import { AlchemyModularV2FactoryWalletData } from "@namera-ai/protocol/model";
import {
  createClient,
  custom,
  encodeFunctionData,
  isAddressEqual,
  type Address,
  type Hex,
  type PublicClient,
  type Chain,
  type Transport,
} from "viem";
import { toAccount } from "viem/accounts";

import { getWebAuthnFactoryArgs } from "../accounts/alchemy-modular-v2.js";
import { ecdsaFactoryDeployment } from "../accounts/factory-ecdsa.js";
import { reconstructEvmAccount } from "../accounts/reconstruct.js";
import { createPublicKeyWebAuthnAccount } from "../accounts/webauthn.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import { compileEvmSession } from "./compile.js";

const cannotSign = async (): Promise<never> => {
  throw new Error("Public review cannot sign");
};

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

/** Factory derivation needs only the public owner address, never a provider credential. */
export type ReviewManagedEvmSessionOperationInput = Omit<
  ReviewEvmSessionOperationInput,
  "wallet" | "ownerPublicKey"
> & {
  readonly wallet: AlchemyModularV2FactoryWalletData;
};
export const reviewManagedEvmSessionOperation: (
  input: ReviewManagedEvmSessionOperationInput,
  publicClient: PublicClient,
) => Effect.Effect<ReviewedEvmSessionOperation, EvmExecutionError> = Effect.fn(
  "evm.sessions.reviewManagedOperation",
)(function* (input, publicClient) {
  return yield* Effect.tryPromise({
    try: async (): Promise<ReviewedEvmSessionOperation> => {
      const wallet = Schema.decodeUnknownSync(Schema.toType(AlchemyModularV2FactoryWalletData))(
        input.wallet,
      );
      const chain = getChainDataByCaip2(input.chainId);
      if (!chain || publicClient.chain?.id !== chain.chain.id)
        throw new Error("Review chain mismatch");
      const account = await toModularAccountV2({
        client: publicClient as PublicClient<Transport, Chain>,
        owner: toAccount({
          address: wallet.ownerAddress,
          signMessage: cannotSign,
          signTypedData: cannotSign,
          signTransaction: cannotSign,
        }),
        mode: "default",
        salt: wallet.salt,
        factory: ecdsaFactoryDeployment.factory,
        implementationAddress: ecdsaFactoryDeployment.implementationAddress,
      });
      if (!isAddressEqual(account.address, wallet.address))
        throw new Error("Review account mismatch");
      const compiled = await compileEvmSession(
        createClient({
          account,
          chain: chain.chain,
          transport: custom(publicClient, { retryCount: 0 }),
        }),
        input.authorization,
      );
      return {
        chainId: input.chainId,
        walletAddress: account.address,
        ownerEntityId: 0,
        factory: ecdsaFactoryDeployment.factory,
        factoryData: encodeFunctionData({
          abi: [
            {
              type: "function",
              name: "createSemiModularAccount",
              inputs: [
                { name: "owner", type: "address" },
                { name: "salt", type: "uint256" },
              ],
              outputs: [{ type: "address" }],
              stateMutability: "nonpayable",
            },
          ],
          functionName: "createSemiModularAccount",
          args: [wallet.ownerAddress, wallet.salt],
        }),
        callData: input.kind === "install" ? compiled.installCallData : compiled.uninstallCallData,
      };
    },
    catch: (cause) => new EvmExecutionError({ code: "PREPARATION_FAILED", cause }),
  });
});
