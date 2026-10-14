import { Effect } from "effect";

import {
  EvmExecutionError,
  type EvmExecutionBilling,
  type EvmExecutionSponsorship,
  type EvmExecutionReceipt,
  type EvmGasPriceQuote,
  type EvmSerializedUserOperation,
} from "@namera-ai/protocol";

import type { ChainData } from "../chains/data.js";
import { nativeWeiToMicroUsd } from "./money.js";

const maximumUserOperationCost = (operation: EvmSerializedUserOperation) =>
  (operation.callGasLimit + operation.verificationGasLimit + operation.preVerificationGas) *
  operation.maxFeePerGas;

export const makeEvmExecutionBilling = Effect.fn("evm.billing.prepareExecution")(function* (input: {
  readonly chain: ChainData;
  readonly sponsorship: EvmExecutionSponsorship;
  readonly estimatedUserOperation: EvmSerializedUserOperation;
  readonly getGasPrice: () => Effect.Effect<EvmGasPriceQuote, EvmExecutionError>;
}): Effect.fn.Return<EvmExecutionBilling, EvmExecutionError> {
  const executionMeter =
    input.chain.environment === "mainnet" ? "execution.mainnet" : "execution.testnet";
  if (input.chain.environment === "testnet" || input.sponsorship === "none") {
    return { executionMeter, sponsorship: null };
  }

  const quote = yield* input.getGasPrice();
  const reservationAmountMicroUsd = nativeWeiToMicroUsd({
    amountWei: maximumUserOperationCost(input.estimatedUserOperation),
    nativePriceMicroUsd: quote.nativePriceMicroUsd,
    surchargeBasisPoints: quote.surchargeBasisPoints,
  });
  if (quote.nativePriceMicroUsd <= 0n || reservationAmountMicroUsd <= 0n)
    return yield* new EvmExecutionError({
      code: "PREPARATION_FAILED",
      cause: new Error("Sponsored mainnet execution requires a positive gas reservation"),
    });
  return {
    executionMeter,
    sponsorship: {
      provider: "alchemy",
      mode: "bso",
      reservationAmountMicroUsd,
      quote,
    },
  };
});

export const settleEvmGasSponsorship = (input: {
  readonly billing: EvmExecutionBilling;
  readonly receipt: EvmExecutionReceipt;
}): bigint => {
  const sponsorship = input.billing.sponsorship;
  if (sponsorship === null) return 0n;
  return nativeWeiToMicroUsd({
    amountWei: input.receipt.actualGasCost,
    nativePriceMicroUsd: sponsorship.quote.nativePriceMicroUsd,
    surchargeBasisPoints: sponsorship.quote.surchargeBasisPoints,
  });
};
