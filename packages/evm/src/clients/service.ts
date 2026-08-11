import { Effect } from "effect";

import { UnsupportedChainError } from "@namera-ai/protocol";
import { createPublicClient as createViemPublicClient, http } from "viem";
import type { Chain } from "viem";
import {
  createBundlerClient as createViemBundlerClient,
  createPaymasterClient as createViemPaymasterClient,
} from "viem/account-abstraction";

import { getChainDataByChainId } from "../chains/helpers.js";
import type { EvmService } from "../layer.js";

const createPublicClient = (chain: Chain, rpcUrl: string) =>
  createViemPublicClient({
    chain,
    transport: http(rpcUrl),
  });

const createBundlerClient = (chain: Chain, rpcUrl: string) =>
  createViemBundlerClient({
    chain,
    transport: http(rpcUrl),
  });

const createPaymasterClient = (rpcUrl: string) =>
  createViemPaymasterClient({
    transport: http(rpcUrl),
  });

type PublicClient = ReturnType<typeof createPublicClient>;
type BundlerClient = ReturnType<typeof createBundlerClient>;
type PaymasterClient = ReturnType<typeof createPaymasterClient>;

export const makeClients = (getRpcUrl: EvmService["getRpcUrl"]) => {
  const publicClients = new Map<number, PublicClient>();
  const bundlerClients = new Map<number, BundlerClient>();
  const paymasterClients = new Map<number, PaymasterClient>();

  const getChain = Effect.fn("EvmClients.getChain")(function* (chainId: number) {
    const data = getChainDataByChainId(chainId);
    if (data === undefined) {
      return yield* new UnsupportedChainError({
        namespace: "eip155",
        chainId: `eip155:${chainId}`,
      });
    }

    return data.chain;
  });

  const getPublicClient = Effect.fn("EvmClients.getPublicClient")(function* (chainId: number) {
    const cached = publicClients.get(chainId);
    if (cached !== undefined) {
      return cached;
    }

    const chain = yield* getChain(chainId);
    const rpcUrl = yield* getRpcUrl(chainId, "public");
    const client = createPublicClient(chain, rpcUrl);
    publicClients.set(chainId, client);

    return client;
  });

  const getBundlerClient = Effect.fn("EvmClients.getBundlerClient")(function* (chainId: number) {
    const cached = bundlerClients.get(chainId);
    if (cached !== undefined) {
      return cached;
    }

    const chain = yield* getChain(chainId);
    const rpcUrl = yield* getRpcUrl(chainId, "bundler");
    const client = createBundlerClient(chain, rpcUrl);
    bundlerClients.set(chainId, client);

    return client;
  });

  const getPaymasterClient = Effect.fn("EvmClients.getPaymasterClient")(function* (
    chainId: number,
  ) {
    const cached = paymasterClients.get(chainId);
    if (cached !== undefined) {
      return cached;
    }

    const rpcUrl = yield* getRpcUrl(chainId, "paymaster");
    const client = createPaymasterClient(rpcUrl);
    paymasterClients.set(chainId, client);

    return client;
  });

  return {
    getPublicClient,
    getBundlerClient,
    getPaymasterClient,
  } as const;
};

export type EvmClients = ReturnType<typeof makeClients>;
