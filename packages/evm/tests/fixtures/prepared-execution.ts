import { DateTime } from "effect";

import {
  Bytes32,
  EthereumAddress,
  Hex,
  type EvmIntentCall,
  type EvmPreparedExecution,
  type EvmSerializedUserOperation,
} from "@namera-ai/protocol";
import { entryPoint07Address } from "viem/account-abstraction";

export const preparedExecutionFixture = (
  userOperation: EvmSerializedUserOperation,
  calls: ReadonlyArray<EvmIntentCall>,
): EvmPreparedExecution => ({
  version: 1,
  namespace: "eip155",
  chainId: "eip155:11155111",
  entryPointVersion: "0.7",
  entryPoint: EthereumAddress.make(entryPoint07Address),
  sponsorship: "none",
  userOperation,
  billing: { executionMeter: "execution.testnet", sponsorship: null },
  context: {
    version: 1,
    namespace: "eip155",
    chainId: "eip155:11155111",
    account: userOperation.sender,
    block: {
      number: 0n,
      hash: Bytes32.make(`0x${"0".repeat(64)}`),
      timestamp: DateTime.fromEpochSeconds(0),
    },
    calls,
    userOperation: {
      nonce: userOperation.nonce,
      paymaster: userOperation.paymaster ?? null,
      gas: {
        callGasLimit: userOperation.callGasLimit,
        verificationGasLimit: userOperation.verificationGasLimit,
        preVerificationGas: userOperation.preVerificationGas,
        maxFeePerGas: userOperation.maxFeePerGas,
        maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas,
        paymasterVerificationGasLimit: userOperation.paymasterVerificationGasLimit ?? 0n,
        paymasterPostOpGasLimit: userOperation.paymasterPostOpGasLimit ?? 0n,
      },
    },
    simulation: {
      userOperation: {
        source: "eth_estimateUserOperationGas",
        callGasLimit: userOperation.callGasLimit,
        verificationGasLimit: userOperation.verificationGasLimit,
        preVerificationGas: userOperation.preVerificationGas,
        maxFeePerGas: userOperation.maxFeePerGas,
        maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas,
      },
      calls: {
        source: "viem.simulateCalls",
        results: calls.map(() => ({ status: "success", returnData: Hex.make("0x"), gasUsed: 0n })),
        assetChanges: [],
        transfers: [],
      },
    },
  },
});
