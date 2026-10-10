import { toModularAccountV2 } from "@alchemy/smart-accounts";
import type { EntryPointVersion } from "@namera-ai/protocol";
import * as Secp256k1 from "ox/Secp256k1";
import { isAddressEqual, type Chain, type PublicClient, type Transport } from "viem";
import type { SmartAccount } from "viem/account-abstraction";
import { publicKeyToAddress } from "viem/accounts";

import { getChainDataByChainId } from "../chains/helpers.js";
import type { AlchemyModularV2Owner } from "./types.js";

// Persisted versions resolve here, never through mutable SDK defaults or caller-supplied addresses.
export const ecdsaFactoryDeployment = {
  factoryVersion: "2.0.0",
  implementationVersion: "v1.0.0",
  factory: "0x00000000000017c61b5bEe81050EC8eFc9c6fecd",
  implementationAddress: "0x000000000000c5A9089039570Dd36455b5C07383",
} as const;

export type MakeFactoryEcdsaAccountProps = {
  readonly accountMode: "factory";
  readonly entryPointVersion: EntryPointVersion;
  readonly salt: bigint;
  readonly owner: Extract<AlchemyModularV2Owner, { validatorType: "ecdsa_secp256k1" }>;
};

export const makeFactoryEcdsaAccount = async (
  props: MakeFactoryEcdsaAccountProps,
  publicClient: PublicClient,
): Promise<SmartAccount> => {
  const chainId = publicClient.chain?.id;
  if (chainId === undefined || getChainDataByChainId(chainId) === undefined) {
    throw new Error("Factory ECDSA accounts require a supported chain-aware public client");
  }
  if (props.entryPointVersion !== "0.7" || props.salt < 0n || props.salt >= 1n << 256n) {
    throw new Error("Invalid factory ECDSA account derivation parameters");
  }
  const owner = props.owner.account;
  if (owner.publicKey?.length !== 132 || !owner.publicKey.startsWith("0x04")) {
    throw new Error("Factory ECDSA owners require an uncompressed secp256k1 public key");
  }
  Secp256k1.noble.Point.fromHex(owner.publicKey.slice(2)).assertValidity();
  if (!isAddressEqual(publicKeyToAddress(owner.publicKey), owner.address)) {
    throw new Error("Factory ECDSA owner address does not match its public key");
  }

  const account = await toModularAccountV2({
    client: publicClient as PublicClient<Transport, Chain>,
    owner,
    mode: "default",
    salt: props.salt,
    factory: ecdsaFactoryDeployment.factory,
    implementationAddress: ecdsaFactoryDeployment.implementationAddress,
  });

  return {
    ...account,
    signUserOperation: async (operation) => {
      if (operation.chainId !== undefined && operation.chainId !== chainId) {
        throw new Error("UserOperation chain does not match the factory account client");
      }
      return account.signUserOperation(operation);
    },
  };
};
