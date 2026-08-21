import { Context, Effect, Layer, Option, Redacted } from "effect";
import { HttpClient } from "effect/unstable/http";

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
import { settleEvmGasSponsorship } from "./billing/execution.js";
import { getChainDataByChainId } from "./chains/helpers.js";
import { makeExecutionClients } from "./clients/execution.js";
import { EvmConfig } from "./config.js";
import { makeEvmExecutionService } from "./execution/service.js";
import type { EvmExecutionService } from "./execution/types.js";
import { makeEvmPolicyService } from "./policy/service.js";
import type { EvmPolicyService } from "./policy/types.js";
import { digestEvmSignature } from "./signing/digest.js";
import { makeEvmSignatureService } from "./signing/sign.js";
import type { DigestEvmSignature, SignEvm, VerifyEvm } from "./signing/types.js";
import { makeEvmTestService, TestEvmExecution, type EvmTestOptions } from "./test.js";

export type EvmRpcType = "public" | "bundler";

const failTestReceipt = (receipt: EvmExecutionReceipt): FailedEvmExecutionReceipt => ({
  ...receipt,
  success: false,
  reason: "Test failure",
});

export interface EvmService {
  readonly createAccount: (
    props: CreateAccountProps,
  ) => Effect.Effect<CreateAccountResult, EvmAccountCreationError | UnsupportedChainError>;
  readonly getRpcUrl: (
    chainId: number,
    type: EvmRpcType,
  ) => Effect.Effect<string, UnsupportedChainError>;
  readonly execution: EvmExecutionService;
  readonly billing: {
    readonly settleGasSponsorship: typeof settleEvmGasSponsorship;
  };
  readonly policy: EvmPolicyService;
  readonly digestSignature: DigestEvmSignature;
  readonly sign: SignEvm;
  readonly verifySignature: VerifyEvm;
}

// Evm is the namespace adapter consumed by application workflows. It owns
// chain clients, smart-account reconstruction, policies, signing, and execution
// while persistence, billing, actors, and notifications remain in application.
export class Evm extends Context.Service<Evm, EvmService>()("@namera-ai/evm/Evm") {
  static readonly layer = Layer.effect(
    Evm,
    Effect.gen(function* () {
      const config = yield* EvmConfig;
      const httpClient = yield* HttpClient.HttpClient;
      const alchemyApiKey = encodeURIComponent(Redacted.value(config.alchemyApiKey));
      const createAccount = makeCreateAccount(config);
      const execution = makeEvmExecutionService(config, httpClient);
      const policy = makeEvmPolicyService();
      const signature = makeEvmSignatureService(makeExecutionClients(config));

      const getRpcUrl = Effect.fn("evm.getRpcUrl")(function* (chainId: number, _type: EvmRpcType) {
        const data = getChainDataByChainId(chainId);
        if (data === undefined) {
          return yield* new UnsupportedChainError({
            namespace: "eip155",
            chainId: `eip155:${chainId}`,
          });
        }

        return `https://${data.alchemyChain}.g.alchemy.com/v2/${alchemyApiKey}`;
      });

      return Evm.of({
        createAccount,
        billing: { settleGasSponsorship: settleEvmGasSponsorship },
        digestSignature: digestEvmSignature,
        getRpcUrl,
        execution,
        policy,
        sign: signature.sign,
        verifySignature: signature.verify,
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
