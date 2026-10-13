import { Config, Context, Effect, Layer, Option, Redacted } from "effect";
import { HttpClient } from "effect/http";

import {
  UnsupportedChainError,
  EvmExecutionError,
  WalletTransactionError,
} from "@namera-ai/protocol";
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
import { makeNativeUsdcQuote } from "./billing/native-usdc-quote.js";
import { makeGetGasSponsorshipCost, type GetGasSponsorshipCost } from "./billing/sponsorship.js";
import { getChainDataByChainId } from "./chains/helpers.js";
import { makeExecutionClients } from "./clients/execution.js";
import { EvmConfig } from "./config.js";
import { makeEvmExecutionService } from "./execution/service.js";
import type { EvmExecutionService } from "./execution/types.js";
import { makeEvmIdentityService, type EvmIdentityService } from "./identity/service.js";
import { makeEvmPolicyService } from "./policy/service.js";
import type { EvmPolicyService } from "./policy/types.js";
import { makeAlchemyPortfolioService } from "./portfolio/alchemy.js";
import type { EvmPortfolioService } from "./portfolio/types.js";
import { makeEvmSessionService } from "./sessions/service.js";
import type { EvmSessionService } from "./sessions/types.js";
import { digestEvmSignature } from "./signing/digest.js";
import { makeEvmOwnerSignatureService, type EvmOwnerSignatureService } from "./signing/owner.js";
import { makeEvmSessionSignatureService } from "./signing/session.js";
import { makeEvmSignatureService } from "./signing/sign.js";
import type { EvmSessionSignatureService } from "./signing/types.js";
import type { DigestEvmSignature, SignEvm, VerifyEvm } from "./signing/types.js";
import { makeEvmTestService, TestEvmExecution, type EvmTestOptions } from "./test.js";

export type EvmRpcType = "public" | "bundler";

const failTestReceipt = (receipt: EvmExecutionReceipt): FailedEvmExecutionReceipt => ({
  ...receipt,
  success: false,
  reason: "Test failure",
});

export interface EvmService {
  readonly identity: EvmIdentityService;
  readonly createAccount: (
    props: CreateAccountProps,
  ) => Effect.Effect<CreateAccountResult, EvmAccountCreationError | UnsupportedChainError>;
  readonly getRpcUrl: (
    chainId: number,
    type: EvmRpcType,
  ) => Effect.Effect<string, UnsupportedChainError>;
  readonly execution: EvmExecutionService;
  readonly sessions: EvmSessionService;
  readonly billing: {
    readonly getNativeUsdcQuote: ReturnType<typeof makeNativeUsdcQuote>;
    readonly settleGasSponsorship: typeof settleEvmGasSponsorship;
    readonly getGasSponsorshipCost: GetGasSponsorshipCost;
  };
  readonly policy: EvmPolicyService;
  readonly portfolio: EvmPortfolioService;
  readonly digestSignature: DigestEvmSignature;
  readonly sign: SignEvm;
  readonly verifySignature: VerifyEvm;
  readonly ownerSignatures: EvmOwnerSignatureService;
  readonly sessionSignatures: EvmSessionSignatureService;
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
      const accessToken = yield* Config.option(Config.Redacted("ALCHEMY_ACCESS_TOKEN"));
      const alchemyApiKey = encodeURIComponent(Redacted.value(config.alchemyApiKey));
      const createAccount = makeCreateAccount(config);
      const execution = makeEvmExecutionService(config, httpClient);
      const policy = makeEvmPolicyService();
      const portfolio = makeAlchemyPortfolioService(config, httpClient);
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
        identity: makeEvmIdentityService(makeExecutionClients(config)),
        createAccount,
        billing: {
          getNativeUsdcQuote: makeNativeUsdcQuote(config.alchemyApiKey, httpClient),
          settleGasSponsorship: settleEvmGasSponsorship,
          getGasSponsorshipCost: makeGetGasSponsorshipCost(
            config.alchemyBsoPolicyId,
            accessToken,
            httpClient,
          ),
        },
        digestSignature: digestEvmSignature,
        getRpcUrl,
        execution,
        sessions: makeEvmSessionService(makeExecutionClients(config), execution),
        policy,
        portfolio,
        ownerSignatures: makeEvmOwnerSignatureService(makeExecutionClients(config)),
        sign: signature.sign,
        verifySignature: signature.verify,
        sessionSignatures: makeEvmSessionSignatureService(makeExecutionClients(config)),
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
          billing: {
            ...service.billing,
            getGasSponsorshipCost:
              options.billing?.getGasSponsorshipCost ?? (() => testExecution.sponsorshipCost),
          },
          execution: {
            ...service.execution,
            checkFunding:
              options.execution?.checkFunding ??
              ((prepared) =>
                Effect.gen(function* () {
                  if (prepared.sponsorship === "none" && !(yield* testExecution.funded))
                    return yield* new WalletTransactionError({ code: "INSUFFICIENT_FUNDS" });
                })),
            submit: (input) =>
              Effect.gen(function* () {
                yield* testExecution.recordSubmission;
                const mode = yield* testExecution.submissionMode;
                if (mode !== "accepted")
                  return yield* new EvmExecutionError({
                    code: mode === "rejected" ? "SUBMISSION_REJECTED" : "SUBMISSION_UNKNOWN",
                    cause: new Error("Test submission failure"),
                  });
                return yield* service.execution.submit(input);
              }),
            getReceipt: Effect.fn("evm.execution.test.controlledGetReceipt")((input) =>
              Effect.flatMap(testExecution.receiptMode, (mode) =>
                mode === "missing"
                  ? Effect.succeed(Option.none())
                  : service.execution
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
                mode === "pending" || mode === "missing"
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
