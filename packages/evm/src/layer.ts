import { Context, Effect, Layer, Redacted, Schema } from "effect";

import { EthereumAddress, UnsupportedChainError } from "@namera-ai/protocol";
import type { EvmAccountCreationError } from "@namera-ai/protocol";

import {
  type CreateAccountProps,
  type CreateAccountResult,
  makeCreateAccount,
} from "./accounts/index.js";
import { getChainDataByChainId } from "./chains/helpers.js";
import { EvmConfig } from "./config.js";

export type EvmRpcType = "public" | "bundler" | "paymaster";

export interface EvmService {
  readonly createAccount: <const Props extends CreateAccountProps>(
    props: Props,
  ) => Effect.Effect<CreateAccountResult<Props>, EvmAccountCreationError | UnsupportedChainError>;
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
      const createAccount = makeCreateAccount(config);

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

      return Evm.of({ createAccount, getRpcUrl });
    }),
  );

  static readonly devLayer = Evm.layer;

  static readonly testLayer = Layer.succeed(
    Evm,
    Evm.of({
      createAccount: Effect.fn("Evm.test.createAccount")(
        <const Props extends CreateAccountProps>(props: Props) => {
          if (props.implementation === "kernel") {
            return Effect.succeed({
              version: 1,
              implementation: "kernel",
              kernelVersion: props.kernelVersion,
              entryPointVersion: props.entryPointVersion,
              validatorType: props.owner.type === "webAuthn" ? "webauthn_p256" : "ecdsa_secp256k1",
              accountIndex: props.accountIndex,
              address: Schema.decodeSync(EthereumAddress)(
                "0x1111111111111111111111111111111111111111",
              ),
            } as CreateAccountResult<Props>);
          }

          return Effect.succeed({
            version: 1,
            implementation: "safe",
            safeVersion: props.safeVersion,
            entryPointVersion: props.entryPointVersion,
            validatorType: props.owner.type === "webAuthn" ? "webauthn_p256" : "ecdsa_secp256k1",
            saltNonce: props.saltNonce,
            address: Schema.decodeSync(EthereumAddress)(
              "0x2222222222222222222222222222222222222222",
            ),
          } as CreateAccountResult<Props>);
        },
      ),
      getRpcUrl: Effect.fn("Evm.test.getRpcUrl")(function* (chainId, type) {
        if (getChainDataByChainId(chainId) === undefined) {
          return yield* new UnsupportedChainError({
            namespace: "eip155",
            chainId: `eip155:${chainId}`,
          });
        }

        return `https://example.test/${chainId}/${type}`;
      }),
    }),
  );
}
