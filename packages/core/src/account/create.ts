import {
  getKernelAddressFromECDSA as getKernelAddressFromECDSACore,
  signerToEcdsaValidator,
} from "@zerodev/ecdsa-validator";
import {
  createKernelAccount,
  createKernelAccountClient,
  type KernelAccountClient,
} from "@zerodev/sdk";
import { getEntryPoint } from "@zerodev/sdk/constants";
import type { KERNEL_V3_VERSION_TYPE, Signer } from "@zerodev/sdk/types";
import type {
  Address,
  Chain,
  Client,
  EntryPointVersion,
  PublicClient,
  RpcSchema,
  Transport,
} from "viem";
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
  kernelVersion: KERNEL_V3_VERSION_TYPE;
  entrypointVersion: EntryPointVersion;
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
  const {
    signer,
    client,
    chain,
    bundlerTransport,
    paymaster,
    index,
    kernelVersion,
    entrypointVersion,
  } = params;

  const entryPoint = getEntryPoint(entrypointVersion);

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

export type GetKernelAddressParams<
  TClientTransport extends Transport = Transport,
  TChain extends Chain = Chain,
> = {
  client: PublicClient<TClientTransport, TChain>;
  eoaAddress: Address;
  index: bigint;
  kernelVersion: KERNEL_V3_VERSION_TYPE;
  entrypointVersion: EntryPointVersion;
};

export const getKernelAddressFromECDSA = async (
  params: GetKernelAddressParams,
): Promise<Address> => {
  const { client, eoaAddress, index, kernelVersion, entrypointVersion } =
    params;
  return await getKernelAddressFromECDSACore({
    entryPoint: getEntryPoint(entrypointVersion),
    eoaAddress,
    index,
    kernelVersion,
    publicClient: client,
  });
};

export type { Signer } from "@zerodev/sdk/types";
