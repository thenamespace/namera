import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  createKernelAccount,
  createKernelAccountClient,
  type KernelAccountClient,
} from "@zerodev/sdk";
import { getEntryPoint } from "@zerodev/sdk/constants";
import type { GetKernelVersion, Signer } from "@zerodev/sdk/types";
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
  TEntrypointVersion extends EntryPointVersion = EntryPointVersion,
  TKernelVersion extends
    GetKernelVersion<TEntrypointVersion> = GetKernelVersion<TEntrypointVersion>,
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
  entrypointVersion: TEntrypointVersion;
  kernelVersion: TKernelVersion;
};

export const createEcdsaAccountClient = async <
  TClientTransport extends Transport,
  TBundlerTransport extends Transport,
  TPaymasterTransport extends Transport,
  TChain extends Chain,
  TRpcSchema extends RpcSchema | undefined,
  TEntrypointVersion extends EntryPointVersion,
  TKernelVersion extends GetKernelVersion<TEntrypointVersion>,
>(
  params: CreateEcdsaAccountClientParams<
    TClientTransport,
    TBundlerTransport,
    TPaymasterTransport,
    TChain,
    TRpcSchema,
    TEntrypointVersion,
    TKernelVersion
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
    paymaster: Paymaster,
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

  account.isDeployed;

  const paymaster = Paymaster
    ? {
        getPaymasterData: (userOp: GetPaymasterDataParameters) => {
          return Paymaster.getPaymasterData(userOp);
        },
        getPaymasterStubData: (userOp: GetPaymasterStubDataParameters) => {
          return Paymaster.getPaymasterStubData(userOp);
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

  kernelClient;

  return kernelClient;
};
