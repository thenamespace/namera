import { Config, Effect, Layer, Redacted, ServiceMap } from "effect";
import type { QuitError } from "effect/Terminal";
import type { Prompt } from "effect/unstable/cli";
import {
  type Chain,
  type Client,
  createPublicClient,
  type HttpTransport,
  http,
  type PublicClient,
} from "viem";

import {
  type ChainWithMetadata,
  getChain,
  type SupportedChain,
  supportedChains,
} from "@/schema";

import { PromptManager } from "./prompt";

export type Web3Service = {
  getPublicClient: (
    params: GetPublicClientParams,
  ) => Effect.Effect<Client<HttpTransport, Chain, undefined>>;
  selectChain: (params: {
    message: string;
  }) => Effect.Effect<SupportedChain, QuitError, Prompt.Environment>;
};

type GetPublicClientParams = {
  chain: SupportedChain;
  rpcUrl?: string;
};

export const Web3Service = ServiceMap.Service<Web3Service>(
  "@namera-ai/cli/Web3Service",
);

export const layer = Layer.effect(
  Web3Service,
  Effect.gen(function* () {
    const promptManager = yield* PromptManager;
    const getRpcUrl = (params: GetPublicClientParams) =>
      Effect.gen(function* () {
        let rpcUrl: string | undefined;

        if (params.rpcUrl) {
          rpcUrl = params.rpcUrl;
        } else {
          // check env
          const envVarName = `${params.chain.replaceAll("-", "_").toUpperCase()}_RPC_URL`;
          const envRpcUrl = yield* Config.option(Config.redacted(envVarName));

          if (envRpcUrl._tag === "Some") {
            rpcUrl = Redacted.value(envRpcUrl.value);
          } else {
            rpcUrl = undefined;
          }
        }

        return rpcUrl;
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

    return Web3Service.of({ getPublicClient, selectChain });
  }),
);
