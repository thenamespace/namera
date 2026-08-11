import { Context, Effect, Layer, Redacted } from "effect";

import { UnsupportedChainError } from "@namera-ai/protocol";

import { getChainDataByChainId } from "./chains/helpers.js";
import { EvmConfig } from "./config.js";

export type EvmRpcType = "public" | "bundler" | "paymaster";

export interface EvmService {
  readonly getRpcUrl: (
    chainId: number,
    type: EvmRpcType,
  ) => Effect.Effect<string, UnsupportedChainError>;
}

export class Evm extends Context.Service<Evm, EvmService>()("@namera-ai/evm/Evm") {
  static readonly layer = Layer.effect(
    Evm,
    Effect.gen(function* () {
      const config = yield* EvmConfig;
      const alchemyApiKey = encodeURIComponent(Redacted.value(config.alchemyApiKey));
      const pimlicoApiKey = encodeURIComponent(Redacted.value(config.pimlicoApiKey));

      const getRpcUrl = Effect.fn("Evm.getRpcUrl")(function* (chainId: number, type: EvmRpcType) {
        const data = getChainDataByChainId(chainId);
        if (data === undefined) {
          return yield* new UnsupportedChainError({
            namespace: "eip155",
            chainId: `eip155:${chainId}`,
          });
        }

        if (type === "public") {
          return `https://${data.alchemyChain}.g.alchemy.com/v2/${alchemyApiKey}`;
        }

        return `https://api.pimlico.io/v2/${data.chain.id}/rpc?apikey=${pimlicoApiKey}`;
      });

      return Evm.of({ getRpcUrl });
    }),
  );
}
