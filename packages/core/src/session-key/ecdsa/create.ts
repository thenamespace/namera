import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  type Policy,
  serializePermissionAccount,
  toPermissionValidator,
} from "@zerodev/permissions";
import { toECDSASigner } from "@zerodev/permissions/signers";
import { addressToEmptyAccount, createKernelAccount } from "@zerodev/sdk";
import { getEntryPoint } from "@zerodev/sdk/constants";
import type {
  Address,
  Chain,
  Client,
  EntryPointVersion,
  Hex,
  JsonRpcAccount,
  LocalAccount,
  Transport,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import type { GetKernelVersion, Signer } from "@/types";

export type CreateEcdsaSessionKeyParams<
  TClientTransport extends Transport = Transport,
  TChain extends Chain = Chain,
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
  index?: bigint;
  policies: Policy[];
  entrypointVersion: TEntrypointVersion;
  kernelVersion: TKernelVersion;
};

export type CreateEcdsaSessionKeyResult = {
  sessionPrivateKey: Hex;
  sessionKeyAddress: Address;
  serializedAccount: string;
};

export const createEcdsaSessionKey = async <
  TClientTransport extends Transport,
  TChain extends Chain,
  TEntrypointVersion extends EntryPointVersion,
  TKernelVersion extends GetKernelVersion<TEntrypointVersion>,
>(
  params: CreateEcdsaSessionKeyParams<
    TClientTransport,
    TChain,
    TEntrypointVersion,
    TKernelVersion
  >,
): Promise<CreateEcdsaSessionKeyResult> => {
  const { signer, client, index, policies, kernelVersion, entrypointVersion } =
    params;

  const entryPoint = getEntryPoint(entrypointVersion);

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

  // @ts-expect-error safe to ignore
  const serializedAccount = await serializePermissionAccount(sessionKeyAccount);

  return {
    serializedAccount,
    sessionKeyAddress,
    sessionPrivateKey,
  };
};
