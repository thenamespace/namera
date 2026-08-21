import { Effect } from "effect";

import type {
  EvmExecutionError,
  EvmExecutionBilling,
  EvmExecutionReceipt,
  EvmGasPriceQuote,
  EvmSerializedUserOperation,
} from "@namera-ai/protocol";

import type { ChainData } from "../chains/data.js";
import { nativeWeiToMicroUsd } from "./money.js";

const maximumUserOperationCost = (operation: EvmSerializedUserOperation) =>
  (operation.callGasLimit +
    operation.verificationGasLimit +
    operation.preVerificationGas +
    (operation.paymasterVerificationGasLimit ?? 0n) +
    (operation.paymasterPostOpGasLimit ?? 0n)) *
  operation.maxFeePerGas;

export const makeEvmExecutionBilling = Effect.fn("evm.billing.prepareExecution")(function* (input: {
  readonly chain: ChainData;
  readonly userOperation: EvmSerializedUserOperation;
  readonly getGasPrice: () => Effect.Effect<EvmGasPriceQuote, EvmExecutionError>;
}) {
  const executionMeter =
    input.chain.environment === "mainnet" ? "execution.mainnet" : "execution.testnet";
  if (input.chain.environment === "testnet" || input.userOperation.paymaster === undefined) {
    return { executionMeter, sponsorship: null };
  }

  const quote = yield* input.getGasPrice();
  return {
    executionMeter,
    sponsorship: {
      provider: "alchemy",
      reservationAmountMicroUsd: nativeWeiToMicroUsd({
        amountWei: maximumUserOperationCost(input.userOperation),
        nativePriceMicroUsd: quote.nativePriceMicroUsd,
        surchargeBasisPoints: quote.surchargeBasisPoints,
      }),
      quote,
    },
  };
});

export const settleEvmGasSponsorship = (input: {
  readonly billing: EvmExecutionBilling;
  readonly receipt: EvmExecutionReceipt;
}): bigint => {
  const sponsorship = input.billing.sponsorship;
  if (sponsorship === null || input.receipt.paymaster === null) return 0n;
  return nativeWeiToMicroUsd({
    amountWei: input.receipt.actualGasCost,
    nativePriceMicroUsd: sponsorship.quote.nativePriceMicroUsd,
    surchargeBasisPoints: sponsorship.quote.surchargeBasisPoints,
  });
};
