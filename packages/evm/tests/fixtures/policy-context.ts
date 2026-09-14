import { DateTime } from "effect";

import {
  Bytes32,
  EthereumAddress,
  Hex,
  SupportedEvmChainId,
  TransactionHash,
  UserOperationHash,
  type EvmIntentContext,
} from "@namera-ai/protocol";
const chainId = SupportedEvmChainId.make("eip155:1");
const address = EthereumAddress.make("0x1111111111111111111111111111111111111111");
export const makeContext = (
  value: bigint,
  timestamp: DateTime.Utc = DateTime.fromEpochSeconds(1),
): EvmIntentContext => ({
  version: 1,
  namespace: "eip155",
  chainId,
  account: address,
  block: {
    number: 1n,
    hash: Bytes32.make(`0x${"1".repeat(64)}`),
    timestamp,
  },
  calls: [{ to: address, value, data: Hex.make("0x") }],
  userOperation: {
    nonce: 0n,
    gas: {
      callGasLimit: 1n,
      verificationGasLimit: 1n,
      preVerificationGas: 1n,
      paymasterVerificationGasLimit: 0n,
      paymasterPostOpGasLimit: 0n,
      maxFeePerGas: 1n,
      maxPriorityFeePerGas: 1n,
    },
    paymaster: null,
  },
  simulation: {
    userOperation: {
      source: "eth_estimateUserOperationGas",
      callGasLimit: 1n,
      verificationGasLimit: 1n,
      preVerificationGas: 1n,
      maxFeePerGas: 1n,
      maxPriorityFeePerGas: 1n,
    },
    calls: {
      source: "viem.simulateCalls",
      results: [{ status: "success", returnData: Hex.make("0x"), gasUsed: 1n }],
      assetChanges: [],
      transfers: [],
    },
  },
});

export const receipt = {
  version: 1,
  namespace: "eip155",
  chainId,
  userOperationHash: UserOperationHash.make(`0x${"2".repeat(64)}`),
  transactionHash: TransactionHash.make(`0x${"3".repeat(64)}`),
  blockHash: Bytes32.make(`0x${"4".repeat(64)}`),
  blockNumber: 2n,
  sender: address,
  nonce: 0n,
  entryPoint: EthereumAddress.make("0x0000000071727de22e5e9d8baf0edac6f37da032"),
  paymaster: null,
  actualGasCost: 1n,
  actualGasUsed: 1n,
  success: true,
  reason: null,
} as const;
