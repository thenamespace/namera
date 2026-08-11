import { Context, Effect, Layer, Redacted } from "effect";

import { UnsupportedChainError } from "@namera-ai/protocol";
import { createPublicClient, http } from "viem";
import type { Chain, PublicClient, Transport } from "viem";
import {
  createBundlerClient,
  createPaymasterClient,
  type BundlerClient,
  type PaymasterClient,
} from "viem/account-abstraction";

import { getChainDataByChainId } from "../chains/helpers.js";
import { EvmConfig } from "../config.js";

export type EvmPublicClient = PublicClient<Transport, Chain>;
export type EvmBundlerClient = BundlerClient<Transport, Chain>;
export type EvmPaymasterClient = PaymasterClient<Transport>;

export interface EvmClientsService {
  readonly getPublicClient: (
    chainId: number,
  ) => Effect.Effect<EvmPublicClient, UnsupportedChainError>;
  readonly getBundlerClient: (
    chainId: number,
  ) => Effect.Effect<EvmBundlerClient, UnsupportedChainError>;
  readonly getPaymasterClient: (
    chainId: number,
  ) => Effect.Effect<EvmPaymasterClient, UnsupportedChainError>;
}

export class EvmClients extends Context.Service<EvmClients, EvmClientsService>()(
  "@namera-ai/evm/EvmClients",
) {
  static readonly layer = Layer.effect(
    EvmClients,
    Effect.gen(function* () {
      const config = yield* EvmConfig;
      const alchemyApiKey = encodeURIComponent(Redacted.value(config.alchemyApiKey));
      const pimlicoApiKey = encodeURIComponent(Redacted.value(config.pimlicoApiKey));

      const publicClients = new Map<number, EvmPublicClient>();
      const bundlerClients = new Map<number, EvmBundlerClient>();
      const paymasterClients = new Map<number, EvmPaymasterClient>();

      const resolveChain = Effect.fn("EvmClients.resolveChain")(function* (chainId: number) {
        const data = getChainDataByChainId(chainId);
        if (data === undefined) {
          return yield* new UnsupportedChainError({
            namespace: "eip155",
            chainId: `eip155:${chainId}`,
          });
        }

        return data;
      });

      const getPublicClient = Effect.fn("EvmClients.getPublicClient")(function* (chainId: number) {
        const cached = publicClients.get(chainId);
        if (cached !== undefined) {
          return cached;
        }

        const data = yield* resolveChain(chainId);
        const client: EvmPublicClient = createPublicClient({
          chain: data.chain,
          transport: http(`https://${data.alchemyChain}.g.alchemy.com/v2/${alchemyApiKey}`),
        });
        publicClients.set(chainId, client);

        return client;
      });

      const getBundlerClient = Effect.fn("EvmClients.getBundlerClient")(function* (
        chainId: number,
      ) {
        const cached = bundlerClients.get(chainId);
        if (cached !== undefined) {
          return cached;
        }

        const data = yield* resolveChain(chainId);
        const client: EvmBundlerClient = createBundlerClient({
          chain: data.chain,
          transport: http(`https://api.pimlico.io/v2/${data.chain.id}/rpc?apikey=${pimlicoApiKey}`),
        });
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

        const data = yield* resolveChain(chainId);
        const client: EvmPaymasterClient = createPaymasterClient({
          transport: http(`https://api.pimlico.io/v2/${data.chain.id}/rpc?apikey=${pimlicoApiKey}`),
        });
        paymasterClients.set(chainId, client);

        return client;
      });

      return EvmClients.of({ getPublicClient, getBundlerClient, getPaymasterClient });
    }),
  );
}
