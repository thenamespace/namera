import { Effect, Redacted } from "effect";

import type { EntryPointVersion, SafeVersion } from "@namera-ai/protocol";
import {
  EthereumAddress,
  EvmAccountCreationError,
  UnsupportedChainError,
} from "@namera-ai/protocol";
import type { SafeWalletData } from "@namera-ai/protocol/model";
import { toSafeSmartAccount } from "permissionless/accounts";
import type { LocalAccount, PublicClient } from "viem";
import { entryPoint07Address, type WebAuthnAccount } from "viem/account-abstraction";

import { getChainDataByChainId } from "../chains/helpers.js";
import { createPublicClient } from "../clients/helpers.js";
import type { EvmConfigValues } from "../config.js";

export type CreateSafeAccountProps = {
  readonly chainId: number;
  readonly entryPointVersion: EntryPointVersion;
  readonly safeVersion: SafeVersion;
  readonly saltNonce: bigint;
  readonly owner: WebAuthnAccount | LocalAccount;
};

type MakeSafeSmartAccountProps = Omit<CreateSafeAccountProps, "chainId">;

export const makeSafeSmartAccount = (
  props: MakeSafeSmartAccountProps,
  publicClient: PublicClient,
) =>
  toSafeSmartAccount({
    client: publicClient,
    entryPoint: {
      address: entryPoint07Address,
      version: props.entryPointVersion,
    },
    saltNonce: props.saltNonce,
    owners: [props.owner],
    version: props.safeVersion,
  });

export const createSafeAccount = Effect.fn("evm.createSafeAccount")(function* (
  props: CreateSafeAccountProps,
  config: EvmConfigValues,
) {
  const chain = getChainDataByChainId(props.chainId);
  if (chain === undefined) {
    return yield* new UnsupportedChainError({
      namespace: "eip155",
      chainId: `eip155:${props.chainId}`,
    });
  }

  const publicClient = createPublicClient(chain, Redacted.value(config.alchemyApiKey));
  const client = yield* Effect.tryPromise({
    try: () => makeSafeSmartAccount(props, publicClient),
    catch: (cause) => new EvmAccountCreationError({ implementation: "safe", cause }),
  });

  return {
    version: 1,
    implementation: "safe",
    safeVersion: props.safeVersion,
    entryPointVersion: props.entryPointVersion,
    validatorType: props.owner.type === "webAuthn" ? "webauthn_p256" : "ecdsa_secp256k1",
    saltNonce: props.saltNonce,
    address: EthereumAddress.make(client.address),
  } satisfies SafeWalletData;
});
