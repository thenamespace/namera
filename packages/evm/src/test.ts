import { Context, Effect, Layer, Ref, Schema } from "effect";

import { EthereumAddress, Hex, UnsupportedChainError } from "@namera-ai/protocol";

import type { CreateAccountProps, CreateAccountResult } from "./accounts/index.js";
import type { EvmAddressMetadataService } from "./address-metadata/types.js";
import { settleEvmGasSponsorship } from "./billing/execution.js";
import { getChainDataByChainId } from "./chains/helpers.js";
import { makeTestEvmExecutionService } from "./execution/test.js";
import type { EvmExecutionService } from "./execution/types.js";
import type { EvmService } from "./layer.js";
import { makeEvmPolicyService } from "./policy/service.js";
import type { EvmPortfolioService } from "./portfolio/types.js";
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
    billing: { settleGasSponsorship: settleEvmGasSponsorship },
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
    policy: makeEvmPolicyService(),
    addressMetadata: {
      resolve: Effect.fn("evm.addressMetadata.test.resolve")(() => Effect.succeed([])),
      search: Effect.fn("evm.addressMetadata.test.search")(() => Effect.succeed([])),
    } satisfies EvmAddressMetadataService,
    portfolio: {
      getAssets: Effect.fn("evm.portfolio.test.getAssets")(() =>
        Effect.succeed({ items: [], partialFailures: [] }),
      ),
    } satisfies EvmPortfolioService,
    digestSignature: digestEvmSignature,
    sign: Effect.fn("evm.signature.test.sign")(() => Effect.succeed(Hex.make("0x1234"))),
    verifySignature: Effect.fn("evm.signature.test.verify")((input) =>
      Effect.succeed(input.signature === Hex.make("0x1234")),
    ),
    ...serviceOverrides,
  };
};
