/** biome-ignore-all lint/style/noNonNullAssertion: safe */
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { toMultiChainECDSAValidator } from "@zerodev/multi-chain-ecdsa-validator";
import {
  type Policy,
  serializeMultiChainPermissionAccounts,
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
  clients: Client<
    TClientTransport,
    TChain,
    JsonRpcAccount | LocalAccount | undefined
  >[];
  index?: bigint;
  policies: Policy[];
  entrypointVersion: TEntrypointVersion;
  kernelVersion: TKernelVersion;
};

export type CreateEcdsaSessionKeyResult = {
  sessionPrivateKey: Hex;
  sessionKeyAddress: Address;
  serializedAccounts: {
    chainId: number;
    serializedAccount: string;
  }[];
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
  const { signer, clients, index, policies, kernelVersion, entrypointVersion } =
    params;

  const entryPoint = getEntryPoint(entrypointVersion);

  const sessionPrivateKey = generatePrivateKey();
  const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);
  const sessionKeyAddress = sessionKeyAccount.address;

  const emptyAccount = addressToEmptyAccount(sessionKeyAddress);

  const emptySessionKeySigner = await toECDSASigner({
    signer: emptyAccount,
  });

  if (clients.length === 0) {
    throw new Error("At least 1 client is required");
  }

  let result: {
    sessionPrivateKey: Hex;
    sessionKeyAddress: Address;
    serializedAccounts: {
      chainId: number;
      serializedAccount: string;
    }[];
  };

  if (clients.length === 1 && clients[0]) {
    // Singe Chain Session Key
    const client = clients[0];

    const ecdsaValidator = await signerToEcdsaValidator(client, {
      entryPoint,
      kernelVersion,
      signer,
    });

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

    const serializedAccount =
      // @ts-expect-error safe to ignore
      await serializePermissionAccount(sessionKeyAccount);

    result = {
      serializedAccounts: [
        {
          chainId: client.chain!.id,
          serializedAccount: serializedAccount,
        },
      ],
      sessionKeyAddress,
      sessionPrivateKey,
    };
  } else {
    // Multichain Session Key

    const accounts = await Promise.all(
      clients.map(async (client) => {
        const multichainValidator = await toMultiChainECDSAValidator(client, {
          entryPoint,
          kernelVersion: kernelVersion,
          signer,
        });

        const permissionPlugin = await toPermissionValidator(client, {
          entryPoint,
          kernelVersion,
          policies,
          signer: emptySessionKeySigner,
        });

        const kernelAccount = await createKernelAccount(client, {
          entryPoint,
          index,
          kernelVersion,
          plugins: {
            regular: permissionPlugin,
            sudo: multichainValidator,
          },
        });

        return {
          kernelAccount,
        };
      }),
    );

    const approvals = await serializeMultiChainPermissionAccounts(
      accounts.map((account) => {
        return {
          // biome-ignore lint/suspicious/noExplicitAny: safe
          account: account.kernelAccount as any,
        };
      }),
    );

    const serializedAccounts = accounts.map((account, i) => {
      return {
        chainId: account.kernelAccount.client.chain!.id,
        serializedAccount: approvals[i] as string,
      };
    });

    result = {
      serializedAccounts,
      sessionKeyAddress,
      sessionPrivateKey,
    };
  }

  return result;
};
