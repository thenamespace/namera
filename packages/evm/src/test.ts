import { Context, Effect, Layer, Ref, Schema } from "effect";

import { EthereumAddress, Hex, UnsupportedChainError } from "@namera-ai/protocol";

import type { CreateAccountProps, CreateAccountResult } from "./accounts/index.js";
import { getChainDataByChainId } from "./chains/helpers.js";
import { makeTestEvmExecutionService } from "./execution/test.js";
import type { EvmExecutionService } from "./execution/types.js";
import type { EvmService } from "./layer.js";
import { makeEvmPolicyService } from "./policy/service.js";
import { digestEvmSignature } from "./signing/digest.js";

export type EvmTestOptions = Omit<Partial<EvmService>, "execution"> & {
  readonly execution?: Partial<EvmExecutionService>;
};

export class TestEvmExecution extends Context.Service<
  TestEvmExecution,
  {
    readonly receiptMode: Effect.Effect<"failed" | "immediate" | "pending">;
    readonly setReceiptMode: (mode: "failed" | "immediate" | "pending") => Effect.Effect<void>;
  }
>()("@namera-ai/evm/TestEvmExecution") {
  static readonly layer = Layer.effect(
    TestEvmExecution,
    Effect.gen(function* () {
      const receiptMode = yield* Ref.make<"failed" | "immediate" | "pending">("immediate");
      return TestEvmExecution.of({
        receiptMode: Ref.get(receiptMode),
        setReceiptMode: (mode) => Ref.set(receiptMode, mode),
      });
    }),
  );
}

export const makeEvmTestService = (options: EvmTestOptions = {}): EvmService => {
  const { execution, ...serviceOverrides } = options;

  return {
    createAccount: Effect.fn("evm.test.createAccount")(
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
          address: Schema.decodeSync(EthereumAddress)("0x2222222222222222222222222222222222222222"),
        } as CreateAccountResult<Props>);
      },
    ),
    getRpcUrl: Effect.fn("evm.test.getRpcUrl")(function* (chainId, type) {
      if (getChainDataByChainId(chainId) === undefined) {
        return yield* new UnsupportedChainError({
          namespace: "eip155",
          chainId: `eip155:${chainId}`,
        });
      }

      return `https://example.test/${chainId}/${type}`;
    }),
    execution: makeTestEvmExecutionService(execution),
    policy: makeEvmPolicyService(),
    digestSignature: digestEvmSignature,
    sign: Effect.fn("evm.signature.test.sign")(() => Effect.succeed(Hex.make("0x1234"))),
    verifySignature: Effect.fn("evm.signature.test.verify")((input) =>
      Effect.succeed(input.signature === Hex.make("0x1234")),
    ),
    ...serviceOverrides,
  };
};
