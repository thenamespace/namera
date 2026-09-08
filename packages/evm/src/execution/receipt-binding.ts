import type { EvmExecutionReceipt, EvmSignedExecution } from "@namera-ai/protocol";

/** Bind provider evidence to the immutable operation before changing permissions or billing. */
export const isReceiptForEvmExecution = (
  signed: EvmSignedExecution,
  receipt: EvmExecutionReceipt,
): boolean =>
  receipt.chainId === signed.chainId &&
  receipt.userOperationHash.toLowerCase() === signed.userOperationHash.toLowerCase() &&
  receipt.sender.toLowerCase() === signed.userOperation.sender.toLowerCase() &&
  receipt.nonce === signed.userOperation.nonce &&
  receipt.entryPoint.toLowerCase() === signed.entryPoint.toLowerCase();
