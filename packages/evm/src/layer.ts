import { Context, Effect, Layer, Redacted } from "effect";

import { UnsupportedChainError } from "@namera-ai/protocol";
import type { EvmAccountCreationError } from "@namera-ai/protocol";

import {
  type CreateAccountProps,
  type CreateAccountResult,
  makeCreateAccount,
} from "./accounts/index.js";
import { getChainDataByChainId } from "./chains/helpers.js";
import { EvmConfig } from "./config.js";
import { makeEvmExecutionService } from "./execution/service.js";
import type { EvmExecutionService } from "./execution/types.js";
import { makeEvmPolicyService } from "./policy/service.js";
import type { EvmPolicyService } from "./policy/types.js";
import { makeEvmTestService, type EvmTestOptions } from "./test.js";

export type EvmRpcType = "public" | "bundler" | "paymaster";

export interface EvmService {
  readonly createAccount: <const Props extends CreateAccountProps>(
    props: Props,
  ) => Effect.Effect<CreateAccountResult<Props>, EvmAccountCreationError | UnsupportedChainError>;
  readonly getRpcUrl: (
    chainId: number,
    type: EvmRpcType,
  ) => Effect.Effect<string, UnsupportedChainError>;
  readonly execution: EvmExecutionService;
  readonly policy: EvmPolicyService;
}

export class Evm extends Context.Service<Evm, EvmService>()("@namera-ai/evm/Evm") {
  static readonly layer = Layer.effect(
    Evm,
    Effect.gen(function* () {
      const config = yield* EvmConfig;
      const alchemyApiKey = encodeURIComponent(Redacted.value(config.alchemyApiKey));
      const pimlicoApiKey = encodeURIComponent(Redacted.value(config.pimlicoApiKey));
      const createAccount = makeCreateAccount(config);
      const execution = makeEvmExecutionService(config);
      const policy = makeEvmPolicyService();

      const getRpcUrl = Effect.fn("evm.getRpcUrl")(function* (chainId: number, type: EvmRpcType) {
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

      return Evm.of({ createAccount, getRpcUrl, execution, policy });
    }),
  );

  static readonly devLayer = Evm.layer;

  static readonly testLayerWith = (options: EvmTestOptions = {}) =>
    Layer.succeed(Evm, Evm.of(makeEvmTestService(options)));

  static readonly testLayer = Evm.testLayerWith();
}
