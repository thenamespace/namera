import { deserializePermissionAccount } from "@zerodev/permissions";
import { toECDSASigner } from "@zerodev/permissions/signers";
import {
  createKernelAccountClient,
  type KernelAccountClient,
} from "@zerodev/sdk";
import { getEntryPoint } from "@zerodev/sdk/constants";
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

import type { GetKernelVersion, Signer } from "@/types";

export type CreateEcdsaSessionKeyClientParams<
  TClientTransport extends Transport = Transport,
  TBundlerTransport extends Transport = Transport,
  TPaymasterTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TRpcSchema extends RpcSchema | undefined = undefined,
  TEntrypointVersion extends EntryPointVersion = EntryPointVersion,
  TKernelVersion extends
    GetKernelVersion<TEntrypointVersion> = GetKernelVersion<TEntrypointVersion>,
> = {
  client: Client<
    TClientTransport,
    TChain,
    JsonRpcAccount | LocalAccount | undefined
  >;
  chain: TChain;
  sessionKeySigner: Signer;
  serializedAccount: string;
  bundlerTransport: TBundlerTransport;
  paymaster?: PaymasterClient<TPaymasterTransport, TRpcSchema>;
  entrypointVersion: TEntrypointVersion;
  kernelVersion: TKernelVersion;
};

export const createEcdsaSessionKeyClient = async <
  TClientTransport extends Transport,
  TBundlerTransport extends Transport,
  TPaymasterTransport extends Transport,
  TChain extends Chain,
  TRpcSchema extends RpcSchema | undefined,
  TEntrypointVersion extends EntryPointVersion,
  TKernelVersion extends GetKernelVersion<TEntrypointVersion>,
>(
  params: CreateEcdsaSessionKeyClientParams<
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
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const {
    sessionKeySigner,
    client,
    serializedAccount,
    bundlerTransport,
    paymaster: _paymaster,
    chain,
    entrypointVersion,
    kernelVersion,
  } = params;

  const entryPoint = getEntryPoint(entrypointVersion);

  const sessionSigner = await toECDSASigner({
    signer: sessionKeySigner,
  });

  const sessionKeyAccount = await deserializePermissionAccount(
    client,
    entryPoint,
    kernelVersion,
    serializedAccount,
    sessionSigner,
  );

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
    account: sessionKeyAccount,
    bundlerTransport,
    chain,
    client,
    name: "Namera Account Client",
    paymaster,
  });

  return kernelClient;
};
