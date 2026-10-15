import { DateTime, Effect } from "effect";
import * as Base64Url from "effect/encoding/Base64Url";

import { toModularAccountV2 } from "@alchemy/smart-accounts";
import type { PrepareWalletTransactionResponse } from "@namera-ai/protocol/dto";
import type { AlchemyModularV2WalletData } from "@namera-ai/protocol/model";
import {
  hashMessage,
  hexToBytes,
  isAddressEqual,
  type Hex,
  type PublicClient,
  type Chain,
  type Transport,
} from "viem";
import { entryPoint07Address, getUserOperationHash } from "viem/account-abstraction";
import type { SmartAccount } from "viem/account-abstraction";
import { toAccount } from "viem/accounts";

import { getWebAuthnFactoryArgs } from "../accounts/alchemy-modular-v2.js";
import { ecdsaFactoryDeployment } from "../accounts/factory-ecdsa.js";
import { reconstructEvmAccount } from "../accounts/reconstruct.js";
import { createPublicKeyWebAuthnAccount } from "../accounts/webauthn.js";
import { primaryNameCall } from "./call.js";

const cannotSign = async (): Promise<never> => {
  throw new Error("Public review cannot sign");
};
export type PrimaryReviewOwner = {
  readonly publicKey: Hex;
  readonly credentialId: string;
  readonly rpId: string;
};
export async function reviewPrimaryName(
  input: {
    readonly wallet: AlchemyModularV2WalletData;
    readonly name: string;
    readonly owner?: PrimaryReviewOwner;
  },
  publicClient: PublicClient,
) {
  const { wallet, owner } = input;
  if (wallet.validatorType === "webauthn_p256" && !owner) throw new Error("Missing passkey owner");
  if (wallet.validatorType === "ecdsa_secp256k1" && wallet.accountMode !== "factory")
    throw new Error("Unsupported owner");
  let account: SmartAccount;
  if (wallet.validatorType === "webauthn_p256" && owner) {
    account = await Effect.runPromise(
      reconstructEvmAccount(
        {
          wallet,
          owner: {
            validatorType: "webauthn_p256",
            account: createPublicKeyWebAuthnAccount(owner.publicKey),
          },
        },
        publicClient,
      ),
    );
  } else if (wallet.validatorType === "ecdsa_secp256k1" && wallet.accountMode === "factory") {
    // Browser review has the public owner address, not the provider's signing key.
    account = await toModularAccountV2({
      client: publicClient as PublicClient<Transport, Chain>,
      owner: toAccount({
        address: wallet.ownerAddress,
        signMessage: cannotSign,
        signTransaction: cannotSign,
        signTypedData: cannotSign,
      }),
      mode: "default",
      salt: wallet.salt,
      factory: ecdsaFactoryDeployment.factory,
      implementationAddress: ecdsaFactoryDeployment.implementationAddress,
    });
    if (!isAddressEqual(account.address, wallet.address))
      throw new Error("Account address mismatch");
  } else throw new Error("Unsupported owner");
  const call = await primaryNameCall(publicClient, input.name);
  const factory =
    wallet.validatorType === "webauthn_p256" && owner
      ? getWebAuthnFactoryArgs(owner.publicKey, wallet.salt, wallet.entityId)
      : await account.getFactoryArgs();
  return {
    address: account.address,
    call,
    callData: await account.encodeCalls([call]),
    ...factory,
    entityId: wallet.validatorType === "webauthn_p256" ? wallet.entityId : 0,
    owner,
    approval: wallet.validatorType === "webauthn_p256" ? "passkey" : "1claw",
  };
}

export type ReviewedPrimaryName = Awaited<ReturnType<typeof reviewPrimaryName>>;

/** Compare the entire signable envelope to independently reconstructed account and call data. */
export function validatePrimaryApproval(
  review: ReviewedPrimaryName,
  response: PrepareWalletTransactionResponse,
  maxGasCostWei: bigint,
  now: DateTime.Utc,
) {
  const { prepared } = response;
  const operation = prepared.userOperation;
  if (
    DateTime.toEpochMillis(now) >= DateTime.toEpochMillis(response.expiresAt) ||
    response.signing.method !== (review.approval === "passkey" ? "passkey" : "server") ||
    prepared.chainId !== "eip155:1" ||
    prepared.context.chainId !== "eip155:1" ||
    prepared.entryPointVersion !== "0.7" ||
    !isAddressEqual(prepared.entryPoint, entryPoint07Address) ||
    !isAddressEqual(operation.sender, review.address) ||
    !isAddressEqual(prepared.context.account, review.address)
  )
    throw new Error("Primary name approval does not match the reviewed transaction");

  const hasFactory = operation.factory !== undefined || operation.factoryData !== undefined;
  if (
    ((operation.nonce >> 64n) & ((1n << 40n) - 1n)) !== ((BigInt(review.entityId) << 8n) | 1n) ||
    operation.authorization !== undefined ||
    (hasFactory &&
      (!operation.factory ||
        !review.factory ||
        !isAddressEqual(operation.factory, review.factory) ||
        !review.factoryData ||
        operation.factoryData?.toLowerCase() !== review.factoryData.toLowerCase()))
  )
    throw new Error("Primary name approval does not match the reviewed transaction");

  const call = prepared.context.calls[0];
  if (
    prepared.context.calls.length !== 1 ||
    !call ||
    !isAddressEqual(call.to, review.call.to) ||
    call.value !== 0n ||
    call.data.toLowerCase() !== review.call.data.toLowerCase() ||
    operation.callData.toLowerCase() !== review.callData.toLowerCase()
  )
    throw new Error("Primary name approval does not match the reviewed transaction");

  const fee =
    (operation.callGasLimit + operation.verificationGasLimit + operation.preVerificationGas) *
    operation.maxFeePerGas;
  if (
    (prepared.sponsorship === "none"
      ? prepared.billing.sponsorship !== null
      : prepared.billing.sponsorship === null ||
        operation.maxFeePerGas !== 0n ||
        operation.maxPriorityFeePerGas !== 0n ||
        operation.preVerificationGas !== 0n) ||
    operation.paymaster !== undefined ||
    operation.paymasterData !== undefined ||
    operation.paymasterVerificationGasLimit !== undefined ||
    operation.paymasterPostOpGasLimit !== undefined ||
    operation.maxPriorityFeePerGas > operation.maxFeePerGas ||
    maxGasCostWei < 0n ||
    fee > maxGasCostWei
  )
    throw new Error("Primary name approval does not match the reviewed transaction");

  const hash = getUserOperationHash({
    userOperation: operation,
    chainId: 1,
    entryPointAddress: entryPoint07Address,
    entryPointVersion: "0.7",
  });
  if (review.approval === "passkey") {
    const options = response.signing.method === "passkey" ? response.signing.options : undefined;
    if (
      !options ||
      !review.owner ||
      options.rpId !== review.owner.rpId ||
      options.userVerification !== "required" ||
      options.allowCredentials.length !== 1 ||
      options.allowCredentials[0]?.id !== review.owner.credentialId ||
      options.challenge !== Base64Url.encode(hexToBytes(hashMessage({ raw: hash })))
    )
      throw new Error("Primary name approval does not match the reviewed transaction");
  } else if (response.signing.method !== "server")
    throw new Error("Primary name approval does not match the reviewed transaction");

  return hash;
}
