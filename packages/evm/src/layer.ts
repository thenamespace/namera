import { Context, Effect, Layer, Option, Redacted } from "effect";

import { UnsupportedChainError } from "@namera-ai/protocol";
import type {
  EvmAccountCreationError,
  EvmExecutionReceipt,
  FailedEvmExecutionReceipt,
} from "@namera-ai/protocol";

import {
  type CreateAccountProps,
  type CreateAccountResult,
  makeCreateAccount,
} from "./accounts/index.js";
import { getChainDataByChainId } from "./chains/helpers.js";
import { makeExecutionClients } from "./clients/execution.js";
import { EvmConfig } from "./config.js";
import { makeEvmExecutionService } from "./execution/service.js";
import type { EvmExecutionService } from "./execution/types.js";
import { makeEvmPolicyService } from "./policy/service.js";
import type { EvmPolicyService } from "./policy/types.js";
import { digestEvmSignature } from "./signing/digest.js";
import { makeEvmSignatureService } from "./signing/sign.js";
import type { DigestEvmSignature, SignEvm } from "./signing/types.js";
import { makeEvmTestService, TestEvmExecution, type EvmTestOptions } from "./test.js";

export type EvmRpcType = "public" | "bundler" | "paymaster";

const failTestReceipt = (receipt: EvmExecutionReceipt): FailedEvmExecutionReceipt => ({
  ...receipt,
  success: false,
  reason: "Test failure",
});

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
  readonly digestSignature: DigestEvmSignature;
  readonly sign: SignEvm;
}

// Evm is the namespace adapter consumed by application workflows. It owns
// chain clients, smart-account reconstruction, policies, signing, and execution
// while persistence, billing, actors, and notifications remain in application.
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
      const sign = makeEvmSignatureService(makeExecutionClients(config)).sign;

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

      return Evm.of({
        createAccount,
        digestSignature: digestEvmSignature,
        getRpcUrl,
        execution,
        policy,
        sign,
      });
    }),
  );

  static readonly devLayer = Evm.layer;

  static readonly testLayerWith = (options: EvmTestOptions = {}) =>
    Layer.effect(
      Evm,
      Effect.gen(function* () {
        const testExecution = yield* TestEvmExecution;
        const service = makeEvmTestService(options);
        return Evm.of({
          ...service,
          execution: {
            ...service.execution,
            getReceipt: Effect.fn("evm.execution.test.controlledGetReceipt")((input) =>
              Effect.flatMap(testExecution.receiptMode, (mode) =>
                service.execution
                  .getReceipt(input)
                  .pipe(
                    Effect.map(
                      Option.map((receipt) =>
                        mode === "failed" ? failTestReceipt(receipt) : receipt,
                      ),
                    ),
                  ),
              ),
            ),
            waitForReceipt: Effect.fn("evm.execution.test.controlledWaitForReceipt")((input) =>
              Effect.flatMap(testExecution.receiptMode, (mode) =>
                mode === "pending"
                  ? Effect.succeed(Option.none())
                  : service.execution
                      .waitForReceipt(input)
                      .pipe(
                        Effect.map(
                          Option.map((receipt) =>
                            mode === "failed" ? failTestReceipt(receipt) : receipt,
                          ),
                        ),
                      ),
              ),
            ),
          },
        });
      }),
    ).pipe(Layer.provideMerge(TestEvmExecution.layer));

  static readonly testLayer = Evm.testLayerWith();
}
