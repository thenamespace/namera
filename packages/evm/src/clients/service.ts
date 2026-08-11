import { Context, Effect, Layer } from "effect";

import type { UnsupportedChainError } from "@namera-ai/protocol";
import { createPublicClient, http } from "viem";
import { createBundlerClient, createPaymasterClient } from "viem/account-abstraction";

import { Evm } from "../layer.js";

export interface EvmRpcRequest {
  readonly method: string;
  readonly params?: readonly unknown[] | Readonly<Record<string, unknown>>;
}

export interface EvmRpcClient {
  readonly request: <TResult = unknown>(request: EvmRpcRequest) => Promise<TResult>;
}

export type EvmPublicClient = EvmRpcClient;
export type EvmBundlerClient = EvmRpcClient;
export type EvmPaymasterClient = EvmRpcClient;

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
      const evm = yield* Evm;

      const publicClients = new Map<number, EvmPublicClient>();
      const bundlerClients = new Map<number, EvmBundlerClient>();
      const paymasterClients = new Map<number, EvmPaymasterClient>();

      const getPublicClient = Effect.fn("EvmClients.getPublicClient")(function* (chainId: number) {
        const cached = publicClients.get(chainId);
        if (cached !== undefined) {
          return cached;
        }

        const rpcUrl = yield* evm.getRpcUrl(chainId, "public");
        const client = createPublicClient({
          transport: http(rpcUrl),
        });
        const rpcClient: EvmPublicClient = {
          request: (request) => client.request(request as never) as Promise<never>,
        };
        publicClients.set(chainId, rpcClient);

        return rpcClient;
      });

      const getBundlerClient = Effect.fn("EvmClients.getBundlerClient")(function* (
        chainId: number,
      ) {
        const cached = bundlerClients.get(chainId);
        if (cached !== undefined) {
          return cached;
        }

        const rpcUrl = yield* evm.getRpcUrl(chainId, "bundler");
        const client = createBundlerClient({
          transport: http(rpcUrl),
        });
        const rpcClient: EvmBundlerClient = {
          request: (request) => client.request(request as never) as Promise<never>,
        };
        bundlerClients.set(chainId, rpcClient);

        return rpcClient;
      });

      const getPaymasterClient = Effect.fn("EvmClients.getPaymasterClient")(function* (
        chainId: number,
      ) {
        const cached = paymasterClients.get(chainId);
        if (cached !== undefined) {
          return cached;
        }

        const rpcUrl = yield* evm.getRpcUrl(chainId, "paymaster");
        const client = createPaymasterClient({
          transport: http(rpcUrl),
        });
        const rpcClient: EvmPaymasterClient = {
          request: (request) => client.request(request as never) as Promise<never>,
        };
        paymasterClients.set(chainId, rpcClient);

        return rpcClient;
      });

      return EvmClients.of({ getPublicClient, getBundlerClient, getPaymasterClient });
    }),
  ).pipe(Layer.provide(Evm.layer));
}
