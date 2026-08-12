import { Effect, Redacted } from "effect";

import type { EntryPointVersion, KernelVersion } from "@namera-ai/protocol";
import {
  EthereumAddress,
  EvmAccountCreationError,
  UnsupportedChainError,
} from "@namera-ai/protocol";
import type { KernelWalletData } from "@namera-ai/protocol/model";
import { toKernelSmartAccount } from "permissionless/accounts";
import type { LocalAccount } from "viem";
import { entryPoint07Address, type WebAuthnAccount } from "viem/account-abstraction";

import { getChainDataByChainId } from "../chains/helpers.js";
import { createPublicClient } from "../clients/helpers.js";
import type { EvmConfigValues } from "../config.js";

export type CreateKernelAccountProps = {
  readonly chainId: number;
  readonly entryPointVersion: EntryPointVersion;
  readonly kernelVersion: KernelVersion;
  readonly accountIndex: bigint;
  readonly owner: WebAuthnAccount | LocalAccount;
};

export const createKernelAccount = Effect.fn("Evm.createKernelAccount")(function* (
  props: CreateKernelAccountProps,
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
    try: () =>
      toKernelSmartAccount({
        client: publicClient,
        entryPoint: {
          address: entryPoint07Address,
          version: props.entryPointVersion,
        },
        index: props.accountIndex,
        owners: [props.owner],
        version: props.kernelVersion,
      }),
    catch: (cause) => new EvmAccountCreationError({ implementation: "kernel", cause }),
  });

  return {
    version: 1,
    implementation: "kernel",
    kernelVersion: props.kernelVersion,
    entryPointVersion: props.entryPointVersion,
    validatorType: props.owner.type === "webAuthn" ? "webauthn_p256" : "ecdsa_secp256k1",
    accountIndex: props.accountIndex,
    address: EthereumAddress.make(client.address),
  } satisfies KernelWalletData;
});
