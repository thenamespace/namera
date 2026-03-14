import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  deserializePermissionAccount,
  type PermissionData,
  type Policy,
  serializePermissionAccount,
  toPermissionValidator,
} from "@zerodev/permissions";
import { toECDSASigner } from "@zerodev/permissions/signers";
import {
  addressToEmptyAccount,
  createKernelAccount,
  createKernelAccountClient,
  type KernelAccountClient,
} from "@zerodev/sdk";
import { getEntryPoint, KERNEL_V3_2 } from "@zerodev/sdk/constants";
import type { Signer } from "@zerodev/sdk/types";
import type {
  Address,
  Chain,
  Client,
  Hex,
  PublicClient,
  RpcSchema,
  Transport,
} from "viem";
import type { PaymasterClient, SmartAccount } from "viem/account-abstraction";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export type CreateSessionKeyParams<
  TClientTransport extends Transport = Transport,
  TChain extends Chain = Chain,
> = {
  signer: Signer;
  client: PublicClient<TClientTransport, TChain>;
  index?: bigint;
  policies: Policy[];
};

export type CreateSessionKeyResult = {
  sessionPrivateKey: Hex;
  sessionKeyAddress: Address;
  serializedPlugin: PermissionData;
  serializedAccount: string;
};

export const createSessionKey = async <
  TClientTransport extends Transport = Transport,
  TChain extends Chain = Chain,
>(
  params: CreateSessionKeyParams<TClientTransport, TChain>,
): Promise<CreateSessionKeyResult> => {
  const { signer, client, index, policies } = params;

  const kernelVersion = KERNEL_V3_2;
  const entryPoint = getEntryPoint("0.7");

  const ecdsaValidator = await signerToEcdsaValidator(client, {
    entryPoint,
    kernelVersion,
    signer,
  });

  const sessionPrivateKey = generatePrivateKey();

  const sessionKeySigner = await toECDSASigner({
    signer: privateKeyToAccount(sessionPrivateKey),
  });
  const sessionKeyAddress = sessionKeySigner.account.address;

  const emptyAccount = addressToEmptyAccount(sessionKeyAddress);
  const emptySessionKeySigner = await toECDSASigner({ signer: emptyAccount });

  const permissionPlugin = await toPermissionValidator(client, {
    entryPoint,
    kernelVersion,
    policies,
    signer: emptySessionKeySigner,
  });

  const sessionKeyAccount = await createKernelAccount(client, {
    entryPoint,
    index,
    kernelVersion,
    plugins: {
      regular: permissionPlugin,
      sudo: ecdsaValidator,
    },
  });

  const serializedAccount = await serializePermissionAccount(sessionKeyAccount);
  const serializedPlugin = permissionPlugin.getPluginSerializationParams();

  return {
    serializedAccount,
    serializedPlugin,
    sessionKeyAddress,
    sessionPrivateKey,
  };
};

export type CreateSessionKeyClientParams<
  TClientTransport extends Transport = Transport,
  TBundlerTransport extends Transport = Transport,
  TPaymasterTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TRpcSchema extends RpcSchema | undefined = undefined,
> = {
  client: PublicClient<TClientTransport, TChain>;
  chain: TChain;
  sessionPrivateKey: Hex;
  serializedAccount: string;
  bundlerTransport: TBundlerTransport;
  paymaster?: PaymasterClient<TPaymasterTransport, TRpcSchema>;
};

export const createSessionKeyClient = async <
  TClientTransport extends Transport = Transport,
  TBundlerTransport extends Transport = Transport,
  TPaymasterTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TRpcSchema extends RpcSchema | undefined = undefined,
>(
  params: CreateSessionKeyClientParams<
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
    sessionPrivateKey,
    client,
    serializedAccount,
    bundlerTransport,
    paymaster,
    chain,
  } = params;

  const kernelVersion = KERNEL_V3_2;
  const entryPoint = getEntryPoint("0.7");

  const sessionKeySigner = await toECDSASigner({
    signer: privateKeyToAccount(sessionPrivateKey),
  });

  const sessionKeyAccount = await deserializePermissionAccount(
    client,
    entryPoint,
    kernelVersion,
    serializedAccount,
    sessionKeySigner,
  );

  const kernelClient = createKernelAccountClient({
    account: sessionKeyAccount,
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
