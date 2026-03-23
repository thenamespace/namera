import { Config, Effect, Layer, Redacted, ServiceMap } from "effect";
import type { QuitError } from "effect/Terminal";
import type { Prompt } from "effect/unstable/cli";
import {
  type Chain,
  type Client,
  createPublicClient,
  type HttpTransport,
  http,
} from "viem";

import {
  type ChainWithMetadata,
  getChain,
  type SupportedChain,
  supportedChains,
} from "@/schema";

import { PromptManager } from "./prompt";

export type Web3Service = {
  /**
   * Creates a viem public client for the requested chain.
   *
   * Falls back to an environment-derived RPC URL when not explicitly provided.
   *
   * @param params - Chain key and optional RPC URL override.
   */
  getPublicClient: (
    params: GetPublicClientParams,
  ) => Effect.Effect<Client<HttpTransport, Chain, undefined>>;
  /**
   * Prompts the user to select a single supported chain.
   *
   * @param params - Prompt message to display.
   */
  selectChain: (params: {
    message: string;
  }) => Effect.Effect<SupportedChain, QuitError, Prompt.Environment>;
  /**
   * Prompts the user to select one or more supported chains.
   *
   * @param params - Prompt message to display.
   */
  multiSelectChain: (params: {
    message: string;
  }) => Effect.Effect<SupportedChain[], QuitError, Prompt.Environment>;
  /**
   * Creates a viem bundler transport for the requested chain.
   *
   * Falls back to an environment-derived RPC URL when not explicitly provided.
   *
   * @param params - Chain key and optional RPC URL override.
   */
  getBundlerTransport: (
    params: GetBundlerClientParams,
  ) => Effect.Effect<HttpTransport<undefined, false>, never, never>;
};

/**
 * Parameters for constructing a public client.
 */
type GetPublicClientParams = {
  /**
   * Target chain identifier key.
   */
  chain: SupportedChain;
  /**
   * Optional RPC URL override for the chain.
   */
  rpcUrl?: string;
};

export type GetBundlerClientParams = {
  /**
   * Target chain identifier key.
   */
  chain: SupportedChain;
  /**
   * Optional RPC URL override for the chain.
   *
   */
  bundlerUrl?: string;
};

/**
 * Service tag for resolving {@link Web3Service} from the Effect context.
 */
export const Web3Service = ServiceMap.Service<Web3Service>(
  "@namera-ai/cli/Web3Service",
);

/**
 * Live layer that wires web3 clients and chain selection prompts.
 */
export const layer = Layer.effect(
  Web3Service,
  Effect.gen(function* () {
    const promptManager = yield* PromptManager;

    const chainNameToEnvVar = (chain: SupportedChain, suffix: string) => {
      return `${chain.replaceAll("-", "_").toUpperCase()}_${suffix}`;
    };

    const getRpcUrl = (params: GetPublicClientParams) =>
      Effect.gen(function* () {
        let rpcUrl: string | undefined;

        if (params.rpcUrl) {
          rpcUrl = params.rpcUrl;
        } else {
          // check env
          const envVarName = chainNameToEnvVar(params.chain, "RPC_URL");
          const envRpcUrl = yield* Config.option(Config.redacted(envVarName));

          if (envRpcUrl._tag === "Some") {
            rpcUrl = Redacted.value(envRpcUrl.value);
          } else {
            rpcUrl = undefined;
          }
        }

        return rpcUrl;
      }).pipe(Effect.orDie);

    const getBundlerUrl = (params: GetBundlerClientParams) =>
      Effect.gen(function* () {
        let bundlerUrl: string | undefined;

        if (params.bundlerUrl) {
          bundlerUrl = params.bundlerUrl;
        } else {
          // check env
          const envVarName = chainNameToEnvVar(params.chain, "BUNDLER_URL");
          const envRpcUrl = yield* Config.option(Config.redacted(envVarName));

          if (envRpcUrl._tag === "Some") {
            bundlerUrl = Redacted.value(envRpcUrl.value);
          } else {
            const chain = getChain(params.chain);
            // Defaults to Pimlico Public RPC
            bundlerUrl = `https://public.pimlico.io/v2/${chain.id}/rpc`;
          }
        }

        return bundlerUrl;
      }).pipe(Effect.orDie);

    const getPublicClient = (params: GetPublicClientParams) =>
      Effect.gen(function* () {
        const rpcUrl = yield* getRpcUrl(params);
        const chain = getChain(params.chain);
        const client = createPublicClient({
          chain,
          transport: http(rpcUrl),
        });

        return client;
      });

    const getBundlerTransport = (params: GetBundlerClientParams) =>
      Effect.gen(function* () {
        const bundlerUrl = yield* getBundlerUrl(params);
        return http(bundlerUrl);
      });

    const selectChain = (params: { message: string }) =>
      Effect.gen(function* () {
        const chains = Object.values(supportedChains) as ChainWithMetadata[];

        const res = yield* promptManager.selectPrompt({
          message: params.message,
          choices: chains.map((c) => ({
            title: c.name,
            value: c.key as SupportedChain,
          })) satisfies Prompt.SelectChoice<SupportedChain>[],
        });

        return res;
      });

    const multiSelectChain = (params: { message: string }) =>
      Effect.gen(function* () {
        const chains = Object.values(supportedChains) as ChainWithMetadata[];

        const res = yield* promptManager.multiSelectPrompt({
          message: params.message,
          choices: chains.map((c) => ({
            title: c.name,
            value: c.key as SupportedChain,
          })) satisfies Prompt.SelectChoice<SupportedChain>[],
          min: 1,
        });

        return res;
      });

    return Web3Service.of({
      getPublicClient,
      selectChain,
      multiSelectChain,
      getBundlerTransport,
    });
  }),
);
