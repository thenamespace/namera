import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  createKernelAccount,
  createKernelAccountClient,
  type KernelAccountClient,
} from "@zerodev/sdk";
import { getEntryPoint, KERNEL_V3_2 } from "@zerodev/sdk/constants";
import type { Signer } from "@zerodev/sdk/types";
import type { Chain, Client, PublicClient, RpcSchema, Transport } from "viem";
import type { PaymasterClient, SmartAccount } from "viem/account-abstraction";

export type CreateAccountParams<
  TClientTransport extends Transport = Transport,
  TBundlerTransport extends Transport = Transport,
  TPaymasterTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TRpcSchema extends RpcSchema | undefined = undefined,
> = {
  signer: Signer;
  client: PublicClient<TClientTransport, TChain>;
  chain: TChain;
  bundlerTransport: TBundlerTransport;
  paymaster?: PaymasterClient<TPaymasterTransport, TRpcSchema>;
  index?: bigint;
};

export const createEcdsaAccount = async <
  TClientTransport extends Transport = Transport,
  TBundlerTransport extends Transport = Transport,
  TPaymasterTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TRpcSchema extends RpcSchema | undefined = undefined,
>(
  params: CreateAccountParams<
    TClientTransport,
    TBundlerTransport,
    TPaymasterTransport,
    TChain,
    TRpcSchema
  >,
): Promise<
  KernelAccountClient<
    TClientTransport,
    TChain,
    SmartAccount,
    Client,
    TRpcSchema
  >
> => {
  const { signer, client, chain, bundlerTransport, paymaster, index } = params;

  const kernelVersion = KERNEL_V3_2;
  const entryPoint = getEntryPoint("0.7");

  const ecdsaValidator = await signerToEcdsaValidator(client, {
    entryPoint,
    kernelVersion,
    signer,
  });

  const account = await createKernelAccount(client, {
    entryPoint,
    index,
    kernelVersion,
    plugins: {
      sudo: ecdsaValidator,
    },
  });

  const kernelClient = createKernelAccountClient({
    account,
    bundlerTransport,
    chain,
    client,
    paymaster: paymaster
      ? {
          getPaymasterData: (userOp) => {
            return paymaster.getPaymasterData(userOp);
          },
          getPaymasterStubData: (userOp) => {
            return paymaster.getPaymasterStubData(userOp);
          },
        }
      : undefined,
  });

  return kernelClient;
};
