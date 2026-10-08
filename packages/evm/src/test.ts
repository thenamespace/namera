import { Context, Effect, Layer, Option, Ref, Schema } from "effect";

import {
  EthereumAddress,
  EvmExecutionError,
  EvmSignatureError,
  Hex,
  UnsupportedChainError,
} from "@namera-ai/protocol";

import type { CreateAccountProps, CreateAccountResult } from "./accounts/index.js";
import { settleEvmGasSponsorship } from "./billing/execution.js";
import type { GasSponsorshipCost } from "./billing/sponsorship.js";
import { getChainDataByChainId } from "./chains/helpers.js";
import { makeTestEvmExecutionService } from "./execution/test.js";
import type { EvmExecutionService } from "./execution/types.js";
import type { EvmService } from "./layer.js";
import { makeEvmPolicyService } from "./policy/service.js";
import type { EvmPortfolioService } from "./portfolio/types.js";
import { digestEvmSignature } from "./signing/digest.js";

export type EvmTestOptions = Omit<Partial<EvmService>, "execution" | "billing"> & {
  readonly execution?: Partial<EvmExecutionService>;
  readonly billing?: Partial<EvmService["billing"]>;
};

type TestReceiptMode = "failed" | "immediate" | "pending" | "missing";

export class TestEvmExecution extends Context.Service<
  TestEvmExecution,
  {
    readonly receiptMode: Effect.Effect<TestReceiptMode>;
    readonly setReceiptMode: (mode: TestReceiptMode) => Effect.Effect<void>;
    readonly sponsorshipCost: Effect.Effect<Option.Option<GasSponsorshipCost>>;
    readonly setSponsorshipCost: (cost: Option.Option<GasSponsorshipCost>) => Effect.Effect<void>;
  }
>()("@namera-ai/evm/TestEvmExecution") {
  static readonly layer = Layer.effect(
    TestEvmExecution,
    Effect.gen(function* () {
      const receiptMode = yield* Ref.make<TestReceiptMode>("immediate");
      const sponsorshipCost = yield* Ref.make(
        Option.some({ amountMicroUsd: 32_400n, confirmedTotalUsd: "0.0324" }),
      );
      return TestEvmExecution.of({
        receiptMode: Ref.get(receiptMode),
        setReceiptMode: (mode) => Ref.set(receiptMode, mode),
        sponsorshipCost: Ref.get(sponsorshipCost),
        setSponsorshipCost: (cost) => Ref.set(sponsorshipCost, cost),
      });
    }),
  );
}

export const makeEvmTestService = (options: EvmTestOptions = {}): EvmService => {
  const { execution, billing, ...serviceOverrides } = options;

  return {
    billing: {
      settleGasSponsorship: settleEvmGasSponsorship,
      getGasSponsorshipCost: () =>
        Effect.succeed(Option.some({ amountMicroUsd: 32_400n, confirmedTotalUsd: "0.0324" })),
      ...billing,
    },
    createAccount: Effect.fn("evm.test.createAccount")((props: CreateAccountProps) => {
      const common = {
        version: 1,
        implementation: "alchemy-modular-v2",
        modularAccountVersion: "2.0.0",
        entryPointVersion: props.entryPointVersion,
        address: Schema.decodeSync(EthereumAddress)("0x3333333333333333333333333333333333333333"),
      } as const;

      return Effect.succeed(
        "salt" in props
          ? ({
              ...common,
              validatorType: "webauthn_p256",
              salt: props.salt,
              entityId: props.entityId,
            } satisfies CreateAccountResult)
          : ({
              ...common,
              validatorType: "ecdsa_secp256k1",
              accountMode: "7702",
              delegationVersion: props.delegationVersion,
            } satisfies CreateAccountResult),
      );
    }),
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
    sessions: {
      compile: Effect.fn("evm.sessions.test.compile")(() =>
        Effect.fail(
          new EvmExecutionError({
            code: "PREPARATION_FAILED",
            cause: new Error("Session compilation requires an explicit test adapter"),
          }),
        ),
      ),
      prepareOperation: Effect.fn("evm.sessions.test.prepareOperation")(() =>
        Effect.fail(
          new EvmExecutionError({
            code: "PREPARATION_FAILED",
            cause: new Error("Session preparation requires an explicit test adapter"),
          }),
        ),
      ),
    },
    policy: makeEvmPolicyService(),
    portfolio: {
      getAssets: Effect.fn("evm.portfolio.test.getAssets")(() =>
        Effect.succeed({ items: [], partialFailures: [] }),
      ),
    } satisfies EvmPortfolioService,
    digestSignature: digestEvmSignature,
    sessionSignatures: {
      prepare: () =>
        Effect.fail(
          new EvmSignatureError({
            code: "SIGNING_FAILED",
            cause: new Error("Session signing requires an explicit test adapter"),
          }),
        ),
      complete: () =>
        Effect.fail(
          new EvmSignatureError({
            code: "SIGNING_FAILED",
            cause: new Error("Session signing requires an explicit test adapter"),
          }),
        ),
    },
    sign: Effect.fn("evm.signature.test.sign")(() => Effect.succeed(Hex.make("0x1234"))),
    verifySignature: Effect.fn("evm.signature.test.verify")((input) =>
      Effect.succeed(input.signature === Hex.make("0x1234")),
    ),
    ...serviceOverrides,
  };
};
