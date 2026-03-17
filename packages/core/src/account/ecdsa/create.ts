import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  createKernelAccount,
  createKernelAccountClient,
  type KernelAccountClient,
} from "@zerodev/sdk";
import { getEntryPoint } from "@zerodev/sdk/constants";
import type { KERNEL_V3_VERSION_TYPE, Signer } from "@zerodev/sdk/types";
import type {
  Chain,
  Client,
  EntryPointVersion,
  JsonRpcAccount,
  LocalAccount,
  RpcSchema,
  Transport,
} from "viem";
import type {
  GetPaymasterDataParameters,
  GetPaymasterStubDataParameters,
  PaymasterClient,
  SmartAccount,
} from "viem/account-abstraction";

export type CreateEcdsaAccountClientParams<
  TClientTransport extends Transport = Transport,
  TBundlerTransport extends Transport = Transport,
  TPaymasterTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TRpcSchema extends RpcSchema | undefined = undefined,
> = {
  signer: Signer;
  client: Client<
    TClientTransport,
    TChain,
    JsonRpcAccount | LocalAccount | undefined
  >;
  chain: TChain;
  bundlerTransport: TBundlerTransport;
  paymaster?: PaymasterClient<TPaymasterTransport, TRpcSchema>;
  index?: bigint;
  kernelVersion: KERNEL_V3_VERSION_TYPE;
  entrypointVersion: EntryPointVersion;
};

export const createEcdsaAccountClient = async <
  TClientTransport extends Transport = Transport,
  TBundlerTransport extends Transport = Transport,
  TPaymasterTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TRpcSchema extends RpcSchema | undefined = undefined,
>(
  params: CreateEcdsaAccountClientParams<
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
    paymaster: _paymaster,
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

  const paymaster = _paymaster
    ? {
        getPaymasterData: (userOp: GetPaymasterDataParameters) => {
          return _paymaster.getPaymasterData(userOp);
        },
        getPaymasterStubData: (userOp: GetPaymasterStubDataParameters) => {
          return _paymaster.getPaymasterStubData(userOp);
        },
      }
    : undefined;

  const kernelClient = createKernelAccountClient({
    account,
    bundlerTransport,
    chain,
    client,
    name: "Namera Account Client",
    paymaster,
  });

  return kernelClient;
};
