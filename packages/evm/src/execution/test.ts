import { DateTime, Effect } from "effect";

import { Bytes32, EthereumAddress, Hex } from "@namera-ai/protocol";
import { entryPoint07Address } from "viem/account-abstraction";

import type { EvmExecutionService } from "./types.js";

export const makeTestEvmExecutionService = (): EvmExecutionService => ({
  prepare: Effect.fn("evm.execution.test.prepare")((input) =>
    Effect.succeed({
      version: 1,
      namespace: "eip155",
      chainId: input.chainId,
      entryPointVersion: "0.7",
      entryPoint: EthereumAddress.make(entryPoint07Address),
      context: {
        version: 1,
        namespace: "eip155",
        chainId: input.chainId,
        account: input.account.wallet.address,
        block: {
          number: 0n,
          hash: Bytes32.make(`0x${"0".repeat(64)}`),
          timestamp: DateTime.fromEpochSeconds(0),
        },
        calls: input.calls,
        userOperation: {
          nonce: 0n,
          gas: {
            callGasLimit: 0n,
            verificationGasLimit: 0n,
            preVerificationGas: 0n,
            paymasterVerificationGasLimit: 0n,
            paymasterPostOpGasLimit: 0n,
            maxFeePerGas: 0n,
            maxPriorityFeePerGas: 0n,
          },
          paymaster: null,
        },
        simulation: null,
      },
      userOperation: {
        sender: input.account.wallet.address,
        nonce: 0n,
        callData: Hex.make("0x"),
        callGasLimit: 0n,
        verificationGasLimit: 0n,
        preVerificationGas: 0n,
        maxFeePerGas: 0n,
        maxPriorityFeePerGas: 0n,
        signature: Hex.make("0x"),
      },
    }),
  ),
});
