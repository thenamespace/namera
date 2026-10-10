import { Effect, Redacted } from "effect";

import { toModularAccountV2, toModularAccountV2Base } from "@alchemy/smart-accounts";
import type { AlchemyModularAccount7702Version, EntryPointVersion } from "@namera-ai/protocol";
import {
  EthereumAddress,
  EvmAccountCreationError,
  UnsupportedChainError,
} from "@namera-ai/protocol";
import type { AlchemyModularV2WalletData } from "@namera-ai/protocol/model";
import * as WebAuthnP256 from "ox/WebAuthnP256";
import {
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  hashMessage,
  hashTypedData,
  toHex,
  zeroAddress,
  type Address,
  type Chain,
  type Hex,
  type LocalAccount,
  type PublicClient,
  type SignableMessage,
  type TypedDataDefinition,
  type Transport,
} from "viem";
import {
  getUserOperationHash,
  type SmartAccount,
  type UserOperation,
  type WebAuthnAccount,
} from "viem/account-abstraction";

import { getChainDataByChainId } from "../chains/helpers.js";
import { createPublicClient } from "../clients/helpers.js";
import type { EvmConfigValues } from "../config.js";
import {
  ecdsaFactoryDeployment,
  makeFactoryEcdsaAccount,
  type MakeFactoryEcdsaAccountProps,
} from "./factory-ecdsa.js";
import { encodeWebAuthnSignature, webAuthnSignatureParameters } from "./passkey-signature.js";
import type { AlchemyModularV2CreationOwner, AlchemyModularV2Owner } from "./types.js";
import { createPublicKeyWebAuthnAccount } from "./webauthn.js";

const modularAccountV2FactoryAddress =
  "0x55010E571dCf07e254994bfc88b9C1C8FAe31960" satisfies Address;
export const webAuthnValidationModuleAddress =
  "0x0000000000001D9d34E07D9834274dF9ae575217" satisfies Address;

const webAuthnFactoryAbi = [
  {
    type: "function",
    name: "createWebAuthnAccount",
    inputs: [
      { name: "ownerX", type: "uint256" },
      { name: "ownerY", type: "uint256" },
      { name: "salt", type: "uint256" },
      { name: "entityId", type: "uint32" },
    ],
    outputs: [{ name: "account", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAddressWebAuthn",
    inputs: [
      { name: "ownerX", type: "uint256" },
      { name: "ownerY", type: "uint256" },
      { name: "salt", type: "uint256" },
      { name: "entityId", type: "uint32" },
    ],
    outputs: [{ name: "account", type: "address" }],
    stateMutability: "view",
  },
] as const;

const dummyWebAuthnSignature = (() => {
  const { metadata } = WebAuthnP256.getSignPayload({
    challenge: `0x${"00".repeat(32)}`,
    origin: "https://example.com",
    rpId: "example.com",
  });

  return encodeAbiParameters(webAuthnSignatureParameters, [
    {
      authenticatorData: metadata.authenticatorData,
      clientDataJSON: metadata.clientDataJSON,
      challengeIndex: BigInt(metadata.challengeIndex ?? 0),
      typeIndex: BigInt(metadata.typeIndex ?? 0),
      r: 1n,
      s: 1n,
    },
  ]);
})();

const getPublicKeyCoordinates = (publicKey: Hex) => {
  if (publicKey.length !== 132 || !publicKey.startsWith("0x04")) {
    throw new Error("Alchemy Modular Account V2 requires an uncompressed P-256 public key");
  }

  return {
    x: BigInt(`0x${publicKey.slice(4, 68)}`),
    y: BigInt(`0x${publicKey.slice(68)}`),
  };
};

// Deployment-independent review data: SmartAccount.getFactoryArgs intentionally
// returns nothing once code exists, but clients still need the canonical origin.
export const getWebAuthnFactoryArgs = (
  publicKey: Hex,
  salt: bigint,
  entityId: number,
): { readonly factory: Address; readonly factoryData: Hex } => {
  const { x, y } = getPublicKeyCoordinates(publicKey);
  return {
    factory: modularAccountV2FactoryAddress,
    factoryData: encodeFunctionData({
      abi: webAuthnFactoryAbi,
      functionName: "createWebAuthnAccount",
      args: [x, y, salt, entityId],
    }),
  };
};

const packUserOperationSignature = (signature: Hex): Hex => concatHex(["0xff", signature]);

const packErc1271Signature = (entityId: number, signature: Hex): Hex =>
  concatHex(["0x00", toHex(entityId, { size: 4 }), "0xff", signature]);

const replaySafeTypedData = (input: {
  readonly accountAddress: Address;
  readonly chainId: number;
  readonly hash: Hex;
}) =>
  ({
    domain: {
      chainId: input.chainId,
      verifyingContract: webAuthnValidationModuleAddress,
      salt: concatHex([`0x${"00".repeat(12)}`, input.accountAddress]),
    },
    types: { ReplaySafeHash: [{ name: "hash", type: "bytes32" }] },
    message: { hash: input.hash },
    primaryType: "ReplaySafeHash" as const,
  }) as const;

const makeOwnerAdapter = (owner: WebAuthnAccount): LocalAccount<"namera-webauthn-p256"> => ({
  address: zeroAddress,
  publicKey: owner.publicKey,
  source: "namera-webauthn-p256",
  type: "local",
  signMessage: async ({ message }) => encodeWebAuthnSignature(await owner.signMessage({ message })),
  signTypedData: async (typedData) => encodeWebAuthnSignature(await owner.signTypedData(typedData)),
  signTransaction: async () => {
    throw new Error("WebAuthn smart-account owners cannot sign EOA transactions");
  },
});

type MakeWebAuthnAlchemyModularV2AccountProps = {
  readonly entryPointVersion: EntryPointVersion;
  readonly owner: Extract<AlchemyModularV2Owner, { validatorType: "webauthn_p256" }>;
  readonly salt: bigint;
  readonly entityId: number;
};

type Make7702AlchemyModularV2AccountProps = {
  readonly entryPointVersion: EntryPointVersion;
  readonly owner: Extract<AlchemyModularV2Owner, { validatorType: "ecdsa_secp256k1" }>;
  readonly delegationVersion: AlchemyModularAccount7702Version;
};

type MakeAlchemyModularV2AccountProps =
  | MakeWebAuthnAlchemyModularV2AccountProps
  | MakeFactoryEcdsaAccountProps
  | Make7702AlchemyModularV2AccountProps;

export type CreateAlchemyModularV2AccountProps =
  | (Omit<MakeWebAuthnAlchemyModularV2AccountProps, "owner"> & {
      readonly chainId: number;
      readonly owner: Extract<AlchemyModularV2CreationOwner, { validatorType: "webauthn_p256" }>;
    })
  | (Make7702AlchemyModularV2AccountProps & { readonly chainId: number })
  | (MakeFactoryEcdsaAccountProps & { readonly chainId: number });

const makeWebAuthnAlchemyModularV2Account = async (
  props: MakeWebAuthnAlchemyModularV2AccountProps,
  publicClient: PublicClient,
): Promise<SmartAccount> => {
  if (publicClient.chain === undefined) {
    throw new Error("Alchemy Modular Account V2 requires a chain-aware public client");
  }

  const chainClient = publicClient as PublicClient<Transport, Chain>;
  const webAuthnOwner = props.owner.account;
  const { x, y } = getPublicKeyCoordinates(webAuthnOwner.publicKey);
  const factoryArgs = getWebAuthnFactoryArgs(webAuthnOwner.publicKey, props.salt, props.entityId);
  const accountAddress = await chainClient.readContract({
    address: modularAccountV2FactoryAddress,
    abi: webAuthnFactoryAbi,
    functionName: "getAddressWebAuthn",
    args: [x, y, props.salt, props.entityId],
  });
  const owner = makeOwnerAdapter(webAuthnOwner);
  const base = await toModularAccountV2Base({
    client: chainClient,
    owner,
    accountAddress,
    signerEntity: { entityId: props.entityId, isGlobalValidation: true },
    getFactoryArgs: async () => factoryArgs,
  });

  return {
    ...base,
    getStubSignature: async () => packUserOperationSignature(dummyWebAuthnSignature),
    signUserOperation: async (userOperation: UserOperation<"0.7">) => {
      const hash = getUserOperationHash({
        chainId: chainClient.chain.id,
        entryPointAddress: base.entryPoint.address,
        entryPointVersion: base.entryPoint.version,
        userOperation: { ...userOperation, sender: accountAddress },
      });
      const signed = await webAuthnOwner.signMessage({ message: { raw: hash } });
      return packUserOperationSignature(encodeWebAuthnSignature(signed));
    },
    signMessage: async ({ message }: { message: SignableMessage }) => {
      const typedData = replaySafeTypedData({
        accountAddress,
        chainId: chainClient.chain.id,
        hash: hashMessage(message),
      });
      const signed = await webAuthnOwner.signTypedData(typedData);
      return packErc1271Signature(props.entityId, encodeWebAuthnSignature(signed));
    },
    signTypedData: async (typedData: TypedDataDefinition) => {
      const replaySafe = replaySafeTypedData({
        accountAddress,
        chainId: chainClient.chain.id,
        hash: hashTypedData(typedData),
      });
      const signed = await webAuthnOwner.signTypedData(replaySafe);
      return packErc1271Signature(props.entityId, encodeWebAuthnSignature(signed));
    },
  } as SmartAccount;
};

export const makeAlchemyModularV2Account = async (
  props: MakeAlchemyModularV2AccountProps,
  publicClient: PublicClient,
): Promise<SmartAccount> => {
  if ("accountMode" in props) {
    return makeFactoryEcdsaAccount(props, publicClient);
  }
  if ("salt" in props) {
    return makeWebAuthnAlchemyModularV2Account(props, publicClient);
  }

  if (publicClient.chain === undefined) {
    throw new Error("Alchemy Modular Account V2 requires a chain-aware public client");
  }

  return toModularAccountV2({
    client: publicClient as PublicClient<Transport, Chain>,
    owner: props.owner.account,
    mode: "7702",
    version: props.delegationVersion,
  });
};

export const createAlchemyModularV2Account = Effect.fn("evm.createAlchemyModularV2Account")(
  function* (props: CreateAlchemyModularV2AccountProps, config: EvmConfigValues) {
    const chain = getChainDataByChainId(props.chainId);
    if (chain === undefined) {
      return yield* new UnsupportedChainError({
        namespace: "eip155",
        chainId: `eip155:${props.chainId}`,
      });
    }

    const publicClient = createPublicClient(chain, Redacted.value(config.alchemyApiKey));
    const account = yield* Effect.tryPromise({
      try: () =>
        makeAlchemyModularV2Account(
          "entityId" in props
            ? {
                ...props,
                owner: {
                  validatorType: "webauthn_p256",
                  account: createPublicKeyWebAuthnAccount(props.owner.publicKey),
                },
              }
            : props,
          publicClient,
        ),
      catch: (cause) =>
        new EvmAccountCreationError({ implementation: "alchemy-modular-v2", cause }),
    });

    if ("accountMode" in props) {
      return {
        version: 1,
        implementation: "alchemy-modular-v2",
        modularAccountVersion: "2.0.0",
        entryPointVersion: props.entryPointVersion,
        validatorType: "ecdsa_secp256k1",
        accountMode: "factory",
        factoryVersion: ecdsaFactoryDeployment.factoryVersion,
        implementationVersion: ecdsaFactoryDeployment.implementationVersion,
        salt: props.salt,
        ownerAddress: EthereumAddress.make(props.owner.account.address),
        address: EthereumAddress.make(account.address),
      } satisfies AlchemyModularV2WalletData;
    }

    if ("entityId" in props) {
      return {
        version: 1,
        implementation: "alchemy-modular-v2",
        modularAccountVersion: "2.0.0",
        entryPointVersion: props.entryPointVersion,
        validatorType: "webauthn_p256",
        salt: props.salt,
        entityId: props.entityId,
        address: EthereumAddress.make(account.address),
      } satisfies AlchemyModularV2WalletData;
    }

    return {
      version: 1,
      implementation: "alchemy-modular-v2",
      modularAccountVersion: "2.0.0",
      entryPointVersion: props.entryPointVersion,
      validatorType: "ecdsa_secp256k1",
      accountMode: "7702",
      delegationVersion: props.delegationVersion,
      address: EthereumAddress.make(account.address),
    } satisfies AlchemyModularV2WalletData;
  },
);
